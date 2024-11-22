const debug = require('debug')('iiif-processor:main');
const mime = require('mime-types');
const path = require('path');
const sharp = require('sharp');
const { Operations } = require('./transform');
const IIIFError = require('./error');
const IIIFVersions = require('./versions');

const defaultpathPrefix = '/iiif/{{version}}/';

function getIiifVersion (url, template) {
  const { origin, pathname } = new URL(url);
  const templateMatcher = template.replace(/\{\{version\}\}/, '(?<iiifVersion>2|3)');
  const pathMatcher = `^(?<prefix>${templateMatcher})(?<request>.+)$`;
  const re = new RegExp(pathMatcher);
  const parsed = re.exec(pathname);
  if (parsed) {
    parsed.groups.prefix = origin + parsed.groups.prefix;
    return { ...parsed.groups };
  } else {
    throw new IIIFError('Invalid IIIF path');
  }
};

class Processor {
  constructor (url, streamResolver, opts = {}) {
    const { prefix, iiifVersion, request } = getIiifVersion(url, opts.pathPrefix || defaultpathPrefix);

    if (typeof streamResolver !== 'function') {
      throw new IIIFError('streamResolver option must be specified');
    }

    if (opts.max?.height && !opts.max?.width) {
      throw new IIIFError('maxHeight cannot be specified without maxWidth');
    };

    const defaults = {
      dimensionFunction: this.defaultDimensionFunction,
      density: null
    };

    this
      .setOpts({ ...defaults, iiifVersion, ...opts, prefix, request })
      .initialize(streamResolver);
  }

  setOpts (opts) {
    this.errorClass = IIIFError;
    this.dimensionFunction = opts.dimensionFunction;
    this.max = { ...opts.max };
    this.includeMetadata = !!opts.includeMetadata;
    this.density = opts.density;
    this.baseUrl = opts.prefix;
    this.sharpOptions = { ...opts.sharpOptions };
    this.version = opts.iiifVersion;
    this.request = opts.request;

    return this;
  }

  initialize (streamResolver) {
    this.Implementation = IIIFVersions[this.version];
    if (!this.Implementation) {
      throw new IIIFError(`No implementation found for IIIF Image API v${this.version}`);
    }

    const params = this.Implementation.Calculator.parsePath(this.request);
    debug('Parsed URL: %j', params);
    Object.assign(this, params);
    this.streamResolver = streamResolver;

    if (this.quality && this.format) {
      this.filename = [this.quality, this.format].join('.');
    } else if (this.info) {
      this.filename = 'info.json';
    }
    return this;
  }

  async withStream ({ id, baseUrl }, callback) {
    debug('Requesting stream for %s', id);
    if (this.streamResolver.length === 2) {
      return await this.streamResolver({ id, baseUrl }, callback);
    } else {
      const stream = await this.streamResolver({ id, baseUrl });
      return await callback(stream);
    }
  }

  async defaultDimensionFunction ({ id, baseUrl }) {
    const result = [];
    let page = 0;
    const target = sharp({ limitInputPixels: false, page });

    return await this.withStream({ id, baseUrl }, async (stream) => {
      stream.pipe(target);
      const { width, height, pages } = await target.metadata();
      result.push({ width, height });
      for (page += 1; page < pages; page++) {
        const scale = 1 / 2 ** page;
        result.push({ width: Math.floor(width * scale), height: Math.floor(height * scale) });
      }
      return result;
    });
  }

  async dimensions () {
    const fallback = this.dimensionFunction !== this.defaultDimensionFunction;

    if (!this.sizeInfo) {
      debug('Attempting to use dimensionFunction to retrieve dimensions for %j', this.id);
      const params = { id: this.id, baseUrl: this.baseUrl };
      let dims = await this.dimensionFunction(params);
      if (fallback && !dims) {
        const warning =
          'Unable to get dimensions for %s using custom function. Falling back to sharp.metadata().';
        debug(warning, this.id);
        console.warn(warning, this.id);
        dims = await this.defaultDimensionFunction(params);
      }
      if (!Array.isArray(dims)) dims = [dims];
      this.sizeInfo = dims;
    }
    return this.sizeInfo;
  }

  async infoJson () {
    const [dim] = await this.dimensions();
    const sizes = [];
    for (let size = [dim.width, dim.height]; size.every((x) => x >= 64); size = size.map((x) => Math.floor(x / 2))) {
      sizes.push({ width: size[0], height: size[1] });
    }

    const uri = new URL(this.baseUrl);
    uri.pathname = path.join(uri.pathname, this.id);
    const id = uri.toString();
    const doc = this.Implementation.infoDoc({ id, ...dim, sizes, max: this.max });
    for (const prop in doc) {
      if (doc[prop] === null || doc[prop] === undefined) delete doc[prop];
    }

    // Serialize sets as arrays
    const body = JSON.stringify(doc, (_key, value) =>
      value?.constructor === Set ? [...value] : value
    );
    return { contentType: 'application/json', body };
  }

  operations (dim) {
    const { sharpOptions: sharp, max } = this;
    return new Operations(this.version, dim, { sharp, max })
      .region(this.region)
      .size(this.size)
      .rotation(this.rotation)
      .quality(this.quality)
      .format(this.format, this.density)
      .withMetadata(this.includeMetadata);
  }

  async iiifImage () {
    const dim = await this.dimensions();
    const operations = this.operations(dim);
    const pipeline = await operations.pipeline();

    const result = await this.withStream({ id: this.id, baseUrl: this.baseUrl }, async (stream) => {
      debug('piping stream to pipeline');
      const transformed = await stream.pipe(pipeline);
      debug('converting to buffer');
      return await transformed.toBuffer();
    });
    debug('returning %d bytes', result.length);
    debug('baseUrl', this.baseUrl);

    const canonicalUrl = new URL(path.join(this.id, operations.canonicalPath()), this.baseUrl);
    return {
      canonicalLink: canonicalUrl.toString(),
      profileLink: this.Implementation.profileLink,
      contentType: mime.lookup(this.format),
      body: result
    };
  }

  async execute () {
    if (this.filename === 'info.json') {
      return await this.infoJson();
    } else {
      return await this.iiifImage();
    }
  }
}

module.exports = Processor;
