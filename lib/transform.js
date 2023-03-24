const Sharp = require('sharp');
const IIIFError = require('./error');
const debug = require('debug')('iiif-processor:transform');
const { Calculator, ...passthrough } = require('./calculator');

const ExtractAttributes = [
  'topOffsetPre',
  'leftOffsetPre',
  'widthPre',
  'heightPre'
];

class Operations extends Calculator {
  #pages;
  #pipeline;

  constructor (dims, opts) {
    super(dims[0]);
    this.#pages = dims
      .map((dim, page) => {
        return { ...dim, page };
      })
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));
    this.#pipeline = Sharp({ limitInputPixels: false, ...opts });
  }

  region (v) {
    super.region(v);
    const { region } = this.info();
    this.#pipeline = this.#pipeline.extract(region);

    const ifPositive = (a, b) => (a > 0 ? a : b);
    this.dims.width = ifPositive(
      this.#pipeline.options.widthPre,
      this.dims.width
    );
    this.dims.height = ifPositive(
      this.#pipeline.options.heightPre,
      this.dims.height
    );

    return this;
  }

  size (v) {
    super.size(v);
    const { size } = this.info();
    this.#pipeline = this.#pipeline.resize(size);
    return this;
  }

  rotation (v) {
    super.rotation(v);
    const { flop, degree } = this.info().rotation;
    if (flop) {
      this.#pipeline = this.#pipeline.flop();
    }
    this.#pipeline = this.#pipeline.rotate(degree);
    return this;
  }

  quality (v) {
    super.quality(v);
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
    super.format(v, density);

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

  #setPage () {
    if (this.#pipeline.options.input.page) return this;

    const { fullSize } = this.info();
    const { page } = this.#pages.find((_candidate, index) => {
      const next = this.#pages[index + 1];
      debug('comparing candidate %j to target %j', next, fullSize);
      return !next || (next.width < fullSize.width && next.height < fullSize.height);
    });

    const resolution = this.#pages[page];
    debug('Using page %d (%j) as source', page, resolution);
    this.#pipeline.options.input.page = page;

    const newScale = Math.round(resolution.width / this.#pages[0].width * 1000) / 1000;
    for (const attr of ExtractAttributes) {
      if (this.#pipeline.options[attr] > 0) {
        this.#pipeline.options[attr] = this.#pipeline.options[attr] * newScale;
      }
    }

    return this;
  }

  withMetadata (v) {
    if (v) this.#pipeline = this.#pipeline.withMetadata();
    return this;
  }

  pipeline () {
    return this.#setPage().#pipeline;
  }
}

module.exports = {
  Operations,
  IIIFError,
  ...passthrough
};
