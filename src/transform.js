const Sharp = require('sharp');
const debug = require('debug')('iiif-processor:transform');
const IIIFVersions = require('./versions');

const ExtractAttributes = [
  'topOffsetPre',
  'leftOffsetPre',
  'widthPre',
  'heightPre'
];

const DEFAULT_PAGE_THRESHOLD = 1;
const SCALE_PRECISION = 10000000;

class Operations {
  #pages;
  #pipeline;

  constructor (version, dims, opts) {
    const { sharp, pageThreshold, ...rest } = opts;
    const Implementation = IIIFVersions[version];
    this.calculator = new Implementation.Calculator(dims[0], rest);
    this.pageThreshold = typeof pageThreshold === 'number' ? pageThreshold : DEFAULT_PAGE_THRESHOLD;

    this.#pages = dims
      .map((dim, page) => {
        return { ...dim, page };
      })
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));
    this.#pipeline = Sharp({ limitInputPixels: false, ...sharp });
  }

  region (v) {
    this.calculator.region(v);
    const { region } = this.info();
    this.#pipeline = this.#pipeline.extract(region);

    const ifPositive = (a, b) => (a > 0 ? a : b);
    this.calculator.dims.width = ifPositive(
      this.#pipeline.options.widthPre,
      this.calculator.dims.width
    );
    this.calculator.dims.height = ifPositive(
      this.#pipeline.options.heightPre,
      this.calculator.dims.height
    );

    return this;
  }

  size (v) {
    this.calculator.size(v);
    const { size } = this.info();
    this.#pipeline = this.#pipeline.resize(size);
    return this;
  }

  rotation (v) {
    this.calculator.rotation(v);
    const { flop, degree } = this.info().rotation;
    if (flop) {
      this.#pipeline = this.#pipeline.flop();
    }
    this.#pipeline = this.#pipeline.rotate(degree);
    return this;
  }

  quality (v) {
    this.calculator.quality(v);
    const { quality } = this.info();
    if (quality === 'color' || quality === 'default') {
      // do nothing
    } else if (quality === 'gray') {
      this.#pipeline = this.#pipeline.grayscale();
    } else if (quality === 'bitonal') {
      this.#pipeline = this.#pipeline.threshold();
    }
    return this;
  }

  format (v, density) {
    this.calculator.format(v, density);

    const { format } = this.info();

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
    this.#pipeline = this.#pipeline.toFormat(pipelineFormat, pipelineOptions);
    if (format.density) {
      this.#pipeline = this.#pipeline.withMetadata({ density: format.density });
    }
    return this;
  }

  info () {
    return this.calculator.info();
  }

  canonicalPath () {
    return this.calculator.canonicalPath();
  }

  #setPage () {
    if (this.#pipeline.options.input.page) return this;

    const { fullSize } = this.info();
    const { page } = this.#pages.find((_candidate, index) => {
      const next = this.#pages[index + 1];
      debug('comparing candidate %j to target %j with a %d-pixel buffer', next, fullSize, this.pageThreshold);
      return !next || (next.width + this.pageThreshold < fullSize.width && next.height + this.pageThreshold < fullSize.height);
    });

    const resolution = this.#pages[page];
    debug('Using page %d (%j) as source', page, resolution);
    this.#pipeline.options.input.page = page;

    const newScale = Math.floor(resolution.width / this.#pages[0].width * SCALE_PRECISION) / SCALE_PRECISION;
    for (const attr of ExtractAttributes) {
      const minimumValue = attr.match(/^(width|height)/) ? 1 : 0;
      if (this.#pipeline.options[attr] > 0) {
        const newValue = Math.max(minimumValue, Math.floor(this.#pipeline.options[attr] * newScale));
        debug('Scaling %s from %f to %f', attr, this.#pipeline.options[attr], newValue);
        this.#pipeline.options[attr] = newValue;
      }
    }

    return this;
  }

  withMetadata (v) {
    if (v) this.#pipeline = this.#pipeline.keepMetadata();
    return this;
  }

  pipeline () {
    return this.#setPage().#pipeline;
  }
}

module.exports = { Operations };
