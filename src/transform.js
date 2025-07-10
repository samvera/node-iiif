const Sharp = require('sharp');
const debug = require('debug')('iiif-processor:transform');
const IIIFVersions = require('./versions');

const DEFAULT_PAGE_THRESHOLD = 1;
const SCALE_PRECISION = 10000000;

class Operations {
  #keepMetadata;
  #pages;
  #sharp;

  constructor (version, dims, opts) {
    const { sharp, pageThreshold, ...rest } = opts;
    const Implementation = IIIFVersions[version];
    this.calculator = new Implementation.Calculator(dims[0], rest);
    this.pageThreshold =
      typeof pageThreshold === 'number'
        ? pageThreshold
        : DEFAULT_PAGE_THRESHOLD;

    this.#pages = dims
      .map((dim, page) => {
        return { ...dim, page };
      })
      .sort((a, b) => b.width * b.height - a.width * a.height);
    this.#sharp = sharp;
  }

  region (v) {
    this.calculator.region(v);
    return this;
  }

  size (v) {
    this.calculator.size(v);
    return this;
  }

  rotation (v) {
    this.calculator.rotation(v);
    return this;
  }

  quality (v) {
    this.calculator.quality(v);
    return this;
  }

  format (v, density) {
    this.calculator.format(v, density);
    return this;
  }

  info () {
    return this.calculator.info();
  }

  canonicalPath () {
    return this.calculator.canonicalPath();
  }

  withMetadata (v) {
    this.#keepMetadata = v;
    return this;
  }

  #computePage () {
    const { fullSize } = this.info();
    const { page } = this.#pages.find((_candidate, index) => {
      const next = this.#pages[index + 1];
      debug('comparing candidate %j to target %j with a %d-pixel buffer', next, fullSize, this.pageThreshold);
      return (
        !next ||
        (next.width + this.pageThreshold < fullSize.width &&
          next.height + this.pageThreshold < fullSize.height)
      );
    });

    const resolution = this.#pages[page];
    const scale = page === 0 ? 1 : Math.round(resolution.width / this.#pages[0].width * SCALE_PRECISION) / SCALE_PRECISION;
    debug('Using page %d (%j) as source and scaling by %f', page, resolution, scale);
    return { page, scale };
  }

  pipeline () {
    const pipeline = Sharp({ limitInputPixels: false, ...this.#sharp });
    const { page, scale } = this.#computePage();
    pipeline.options.input.page = page;
    // Set Region
    const { format, quality, region, rotation: { flop, degree }, size } = this.info();
    scaleRegion(region, scale, this.#pages[page]);

    pipeline.autoOrient().extract(region).resize(size);

    flop && pipeline.flop();
    pipeline.rotate(degree);
    quality === 'gray' && pipeline.grayscale();
    quality === 'bitonal' && pipeline.threshold();
    setFormat(pipeline, format);
    this.#keepMetadata && pipeline.keepMetadata();

    debug('Pipeline: %j', { page, region, size, rotation: { flop, degree }, quality, format });

    return pipeline;
  }
}

const setFormat = (pipeline, format) => {
  let pipelineFormat;
  const pipelineOptions = {};

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
};

const scaleRegion = (region, scale, page) => {
  for (const dim in region) {
    region[dim] = Math.floor(region[dim] * scale);
  }

  region.left = Math.max(region.left, 0);
  region.top = Math.max(region.top, 0);
  region.width = Math.min(region.width, page.width);
  region.height = Math.min(region.height, page.height);

  return region;
};

module.exports = { Operations };
