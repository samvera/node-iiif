import Sharp, { Sharp as SharpType } from 'sharp';
import Debug from 'debug';
import { IIIFError } from './error';
import { Versions } from './versions';
import type { VersionModule, CalculatorLike, CalculatorOptions } from './contracts';
import type { Dimensions, BoundingBox, Format } from './types';

const debug = Debug('iiif-processor:transform');

const DEFAULT_PAGE_THRESHOLD = 1;
const SCALE_PRECISION = 10000000;

type PageDim = { width: number; height: number; page: number };

export class Operations {
  private keepMetadata?: boolean;
  private pages: PageDim[];
  private sharpOptions?: Record<string, unknown>;
  private calculator: CalculatorLike;
  private pageThreshold: number;

  constructor (version: number, dims: Dimensions[], opts: CalculatorOptions & { sharp?: Record<string, unknown>; pageThreshold?: number }) {
    const { sharp, pageThreshold, ...rest } = { ...opts };
    const Implementation: VersionModule = Versions[version];
    this.calculator = new Implementation.Calculator(dims[0], rest);
    this.pageThreshold = typeof pageThreshold === 'number' ? pageThreshold : DEFAULT_PAGE_THRESHOLD;

    this.pages = dims
      .map((dim, page) => ({ ...dim, page }))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    this.sharpOptions = sharp;
  }

  region (v: string) {
    this.calculator.region(v);
    return this;
  }

  size (v: string) {
    this.calculator.size(v);
    return this;
  }

  rotation (v: string) {
    this.calculator.rotation(v);
    return this;
  }

  quality (v: string) {
    this.calculator.quality(v);
    return this;
  }

  format (v: string, density?: number) {
    this.calculator.format(v, density);
    return this;
  }

  info () {
    return this.calculator.info();
  }

  canonicalPath () {
    return this.calculator.canonicalPath();
  }

  withMetadata (v: boolean) {
    this.keepMetadata = v;
    return this;
  }

  private computePage () {
    const { fullSize } = this.info();
    const { page } = this.pages.find((_candidate, index) => {
      const next = this.pages[index + 1];
      debug('comparing candidate %j to target %j with a %d-pixel buffer', next, fullSize, this.pageThreshold);
      return !next || (next.width + this.pageThreshold < fullSize.width && next.height + this.pageThreshold < fullSize.height);
    }) as PageDim;

    const resolution = this.pages[page];
    const scale = page === 0 ? 1 : Math.round((resolution.width / this.pages[0].width) * SCALE_PRECISION) / SCALE_PRECISION;
    debug('Using page %d (%j) as source and scaling by %f', page, resolution, scale);
    return { page, scale };
  }

  pipeline (): SharpType {
    const pipeline = Sharp({
      limitInputPixels: false,
      ...{ ...this.sharpOptions }
    });
    const { page, scale } = this.computePage();
    (pipeline as any).options.input.page = page; // eslint-disable-line @typescript-eslint/no-explicit-any

    const { format, quality, region, rotation: { flop, degree }, size } = this.info();
    scaleRegion(region, scale, this.pages[page]);
    if (region.width < 1 || region.height < 1) {
      throw new IIIFError('Requested region is too small to render', { statusCode: 400 });
    }
    clampSize(size);

    pipeline.autoOrient().extract(region);
    if (size.width !== region.width || size.height !== region.height || size.fit === 'inside') {
      pipeline.resize(size);
    }
    if (flop) pipeline.flop();
    pipeline.rotate(degree);
    if (quality === 'gray') pipeline.grayscale();
    if (quality === 'bitonal') pipeline.threshold();
    setFormat(pipeline, format);
    if (this.keepMetadata) pipeline.keepMetadata();

    debug('Pipeline: %j', { page, region, size, rotation: { flop, degree }, quality, format });
    return pipeline;
  }
}

function setFormat (pipeline: SharpType, format: { type: Format; density?: number }) {
  let pipelineFormat;
  const pipelineOptions: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

  switch (format.type) {
    case 'jpeg':
      pipelineFormat = 'jpg';
      break;
    case 'tif':
      pipelineFormat = 'tiff';
      if (format.density) {
        pipelineOptions.xres = format.density / 25.4;
        pipelineOptions.yres = format.density / 25.4;
      }
      break;
    default:
      pipelineFormat = format.type;
  }
  pipeline.toFormat(pipelineFormat, pipelineOptions);
  if (format.density) {
    pipeline.withMetadata({ density: format.density });
  }
}

function scaleRegion (region: BoundingBox, scale: number, page: { width: number; height: number }) {
  region.left = Math.floor(region.left * scale);
  region.top = Math.floor(region.top * scale);
  region.width = Math.floor(region.width * scale);
  region.height = Math.floor(region.height * scale);

  // Clamp the scaled region to the selected page bounds.
  region.left = Math.max(Math.min(region.left, page.width), 0);
  region.top = Math.max(Math.min(region.top, page.height), 0);
  region.width = Math.min(region.width, page.width - region.left);
  region.height = Math.min(region.height, page.height - region.top);
  return region;
}

// Ensure calculated output dimensions are at least one pixel.
function clampSize (size: { width?: number | null; height?: number | null }) {
  if (typeof size.width === 'number') size.width = Math.max(size.width, 1);
  if (typeof size.height === 'number') size.height = Math.max(size.height, 1);
  return size;
}

export default { Operations };
