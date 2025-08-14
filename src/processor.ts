import Debug from 'debug';
import mime from 'mime-types';
import path from 'path';
import sharp from 'sharp';
import { Operations } from './transform';
import { IIIFError } from './error';
import Versions from './versions';

const debug = Debug('iiif-processor:main');
const debugv = Debug('verbose:iiif-processor');

const defaultpathPrefix = '/iiif/{{version}}/';

function getIiifVersion(url: string, template: string) {
  const { origin, pathname } = new URL(url);
  const templateMatcher = template.replace(/\{\{version\}\}/, '(?<iiifVersion>2|3)');
  const pathMatcher = `^(?<prefix>${templateMatcher})(?<request>.+)$`;
  const re = new RegExp(pathMatcher);
  const parsed = re.exec(pathname) as any;
  if (parsed) {
    parsed.groups.prefix = origin + parsed.groups.prefix;
    return { ...parsed.groups } as { prefix: string; iiifVersion: string; request: string };
  } else {
    throw new IIIFError('Invalid IIIF path');
  }
}

type Dimensions = { width: number; height: number };

type StreamResolver = (input: { id: string; baseUrl: string }) => any;
type StreamResolverWithCallback = (
  input: { id: string; baseUrl: string },
  callback: (stream: any) => Promise<any>
) => Promise<any>;

export class Processor {
  private errorClass = IIIFError;
  private Implementation: any;
  private sizeInfo?: Dimensions[];
  private sharpOptions?: Record<string, unknown>;

  id!: string;
  baseUrl!: string;
  version!: number;
  request!: string;
  streamResolver!: StreamResolver | StreamResolverWithCallback;
  filename?: string;

  // parsed params
  info?: string;
  region!: string;
  size!: string;
  rotation!: string;
  quality!: string;
  format!: string;

  // options
  dimensionFunction!: (input: { id: string; baseUrl: string }) => Promise<Dimensions | Dimensions[]>;
  max?: { width?: number; height?: number; area?: number };
  includeMetadata = false;
  density?: number | null;
  debugBorder = false;
  pageThreshold?: number;

  constructor(url: string, streamResolver: any, opts: any = {}) {
    const { prefix, iiifVersion, request } = getIiifVersion(url, opts.pathPrefix || defaultpathPrefix);

    if (typeof streamResolver !== 'function') {
      throw new IIIFError('streamResolver option must be specified');
    }

    if (opts.max?.height && !opts.max?.width) {
      throw new IIIFError('maxHeight cannot be specified without maxWidth');
    }

    const defaults = {
      dimensionFunction: this.defaultDimensionFunction.bind(this),
      density: null
    };

    this
      .setOpts({ ...defaults, iiifVersion, ...opts, prefix, request })
      .initialize(streamResolver);
  }

  setOpts(opts: any) {
    this.dimensionFunction = opts.dimensionFunction;
    this.max = { ...opts.max };
    this.includeMetadata = !!opts.includeMetadata;
    this.density = opts.density;
    this.baseUrl = opts.prefix;
    this.debugBorder = !!opts.debugBorder;
    this.pageThreshold = opts.pageThreshold;
    this.sharpOptions = { ...opts.sharpOptions };
    this.version = Number(opts.iiifVersion);
    this.request = opts.request;
    return this;
  }

  initialize(streamResolver: any) {
    this.Implementation = (Versions as any)[this.version];
    if (!this.Implementation) {
      throw new IIIFError(`No implementation found for IIIF Image API v${this.version}`);
    }

    const params = this.Implementation.Calculator.parsePath(this.request);
    debug('Parsed URL: %j', params);
    Object.assign(this, params);
    this.streamResolver = streamResolver;

    if ((this as any).quality && (this as any).format) {
      this.filename = [this.quality, this.format].join('.');
    } else if ((this as any).info) {
      this.filename = 'info.json';
    }
    return this;
  }

  async withStream({ id, baseUrl }: { id: string; baseUrl: string }, callback: (s: any) => Promise<any>) {
    debug('Requesting stream for %s', id);
    if ((this.streamResolver as any).length === 2) {
      return await (this.streamResolver as StreamResolverWithCallback)({ id, baseUrl }, callback);
    } else {
      const stream = await (this.streamResolver as StreamResolver)({ id, baseUrl });
      return await callback(stream);
    }
  }

  async defaultDimensionFunction({ id, baseUrl }: { id: string; baseUrl: string }): Promise<Dimensions[]> {
    const result: Dimensions[] = [];
    let page = 0;
    const target = sharp({ limitInputPixels: false, page });

    return await this.withStream({ id, baseUrl }, async (stream) => {
      stream.pipe(target);
      const { width, height, pages } = await target.metadata();
      if (!width || !height || !pages) return result;
      result.push({ width, height });
      for (page += 1; page < pages; page++) {
        const scale = 1 / 2 ** page;
        result.push({ width: Math.floor(width * scale), height: Math.floor(height * scale) });
      }
      return result;
    });
  }

  async dimensions(): Promise<Dimensions[]> {
    const fallback = this.dimensionFunction !== this.defaultDimensionFunction.bind(this);

    if (!this.sizeInfo) {
      debug('Attempting to use dimensionFunction to retrieve dimensions for %j', (this as any).id);
      const params = { id: (this as any).id, baseUrl: this.baseUrl };
      let dims: any = await this.dimensionFunction(params);
      if (fallback && !dims) {
        const warning = 'Unable to get dimensions for %s using custom function. Falling back to sharp.metadata().';
        debug(warning, (this as any).id);
        console.warn(warning, (this as any).id);
        dims = await this.defaultDimensionFunction(params);
      }
      if (!Array.isArray(dims)) dims = [dims];
      this.sizeInfo = dims as Dimensions[];
    }
    return this.sizeInfo;
  }

  async infoJson() {
    const [dim] = await this.dimensions();
    const sizes: Array<{ width: number; height: number }> = [];
    for (let size = [dim.width, dim.height]; size.every((x) => x >= 64); size = size.map((x) => Math.floor(x / 2))) {
      sizes.push({ width: size[0], height: size[1] });
    }

    const uri = new URL(this.baseUrl);
    (uri as any).pathname = path.join((uri as any).pathname, (this as any).id);
    const id = uri.toString();
    const doc = this.Implementation.infoDoc({ id, ...dim, sizes, max: this.max });
    for (const prop in doc) {
      if (doc[prop] === null || doc[prop] === undefined) delete doc[prop];
    }

    const body = JSON.stringify(doc, (_key, value) => (value?.constructor === Set ? [...value] : value));
    return { contentType: 'application/json', body } as const;
  }

  operations(dim: Dimensions[]) {
    const { sharpOptions: sharpOpt, max, pageThreshold } = this as any;
    debug('pageThreshold: %d', pageThreshold);
    return new Operations(this.version, dim, { sharp: sharpOpt, max, pageThreshold })
      .region((this as any).region)
      .size((this as any).size)
      .rotation((this as any).rotation)
      .quality((this as any).quality)
      .format((this as any).format, this.density)
      .withMetadata(this.includeMetadata);
  }

  async applyBorder(transformed: any) {
    const buf = await transformed.toBuffer();
    const borderPipe = sharp(buf, { limitInputPixels: false });
    const { width, height } = await borderPipe.metadata();
    const background = { r: 255, g: 0, b: 0, alpha: 1 } as any;

    const topBorder = { create: { width, height: 1, channels: 4, background } } as any;
    const bottomBorder = { create: { width, height: 1, channels: 4, background } } as any;
    const leftBorder = { create: { width: 1, height, channels: 4, background } } as any;
    const rightBorder = { create: { width: 1, height, channels: 4, background } } as any;

    return borderPipe.composite([
      { input: topBorder, left: 0, top: 0 },
      { input: bottomBorder, left: 0, top: (height as number) - 1 },
      { input: leftBorder, left: 0, top: 0 },
      { input: rightBorder, left: (width as number) - 1, top: 0 }
    ]);
  }

  async iiifImage() {
    debugv('Request %s', (this as any).request);
    const dim = await this.dimensions();
    const operations = this.operations(dim);
    debugv('Operations: %j', operations);
    const pipeline = await (operations as any).pipeline();

    const result = await this.withStream({ id: (this as any).id, baseUrl: this.baseUrl }, async (stream) => {
      debug('piping stream to pipeline');
      let transformed = await stream.pipe(pipeline);
      if (this.debugBorder) {
        transformed = await this.applyBorder(transformed);
      }
      debug('converting to buffer');
      return await transformed.toBuffer();
    });
    debug('returning %d bytes', (result as Buffer).length);
    debug('baseUrl', this.baseUrl);

    const canonicalUrl = new URL(path.join((this as any).id, (operations as any).canonicalPath()), this.baseUrl);
    return {
      canonicalLink: canonicalUrl.toString(),
      profileLink: this.Implementation.profileLink,
      contentType: mime.lookup((this as any).format) as string,
      body: result as Buffer
    };
  }

  async execute() {
    if (this.filename === 'info.json') {
      return await this.infoJson();
    } else {
      return await this.iiifImage();
    }
  }
}

export default Processor;
