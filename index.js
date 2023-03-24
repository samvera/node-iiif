const debug = require('debug')('iiif-processor:main');
const mime = require('mime-types');
const sharp = require('sharp');
const { Formats, Qualities, Operations, pathToIiif } = require('./lib/transform');
const IIIFError = require('./lib/error');
const IIIFProfile = [
  'http://iiif.io/api/image/2/level2.json',
  {
    formats: Formats,
    qualities: Qualities,
    supports: [
      'regionByPx',
      'sizeByW',
      'sizeByWhListed',
      'cors',
      'regionSquare',
      'sizeByDistortedWh',
      'sizeAboveFull',
      'canonicalLinkHeader',
      'sizeByConfinedWh',
      'sizeByPct',
      'jsonldMediaType',
      'regionByPct',
      'rotationArbitrary',
      'sizeByH',
      'baseUriRedirect',
      'rotationBy90s',
      'profileLinkHeader',
      'sizeByForcedWh',
      'sizeByWh',
      'mirroring'
    ]
  }
];

const DefaultPathPrefix = '/iiif/2/';

const fixupSlashes = (path, leaveOne) => {
  const replacement = leaveOne ? '/' : '';
  return path?.replace(/^\/*/, replacement).replace(/\/*$/, replacement);
};

class Processor {
  constructor (url, streamResolver, ...args) {
    const opts = this.parseOpts(args);

    if (typeof streamResolver !== 'function') {
      throw new IIIFError('streamResolver option must be specified');
    }

    this
      .setOpts(opts)
      .initialize(url, streamResolver);
  }

  parseOpts (args) {
    if (args.length >= 1 && typeof args[0] === 'function') {
      console.warn('Passing dimensionFunction, maxWidth, and includeMetadata as separate parameters is deprecated. Please see the documentation.');
      return {
        dimensionFunction: args.shift(),
        maxWidth: args.shift(),
        includeMetadata: args.shift()
      };
    } else if (args.length === 1 && typeof args[0] === 'object') {
      return args[0];
    } else {
      return {};
    }
  }

  setOpts (opts) {
    this.errorClass = IIIFError;
    this.dimensionFunction = opts.dimensionFunction || this.defaultDimensionFunction;
    this.maxWidth = opts.maxWidth;
    this.includeMetadata = !!opts.includeMetadata;
    this.density = opts.density || null;
    this.pathPrefix = fixupSlashes(opts.pathPrefix, true) || DefaultPathPrefix;
    this.sharpOptions = opts.sharpOptions || {};

    return this;
  }

  parseUrl (url) {
    const parser = new RegExp(`(?<baseUrl>https?://[^/]+${this.pathPrefix})(?<path>.+)$`);
    const { baseUrl, path } = parser.exec(url).groups;
    const result = pathToIiif(path);
    result.baseUrl = baseUrl;

    return result;
  }

  initialize (url, streamResolver) {
    const params = this.parseUrl(url);
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
    const target = sharp({ page });

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

    const doc = this.infoDoc(dim, sizes);

    if (this.maxWidth) doc.profile[1].maxWidth = this.maxWidth;

    return { contentType: 'application/json', body: JSON.stringify(doc) };
  }

  infoDoc (dim, sizes) {
    return {
      '@context': 'http://iiif.io/api/image/2/context.json',
      '@id': [fixupSlashes(this.baseUrl), fixupSlashes(this.id)].join('/'),
      protocol: 'http://iiif.io/api/image',
      width: dim.width,
      height: dim.height,
      sizes,
      tiles: [{ width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }],
      profile: IIIFProfile
    };
  }

  async pipeline (dim) {
    return new Operations(dim, this.sharpOptions)
      .region(this.region)
      .size(this.size)
      .rotation(this.rotation)
      .quality(this.quality)
      .format(this.format, this.density)
      .withMetadata(this.includeMetadata)
      .pipeline();
  }

  async iiifImage () {
    const dim = await this.dimensions();
    const pipeline = await this.pipeline(dim);

    const result = await this.withStream({ id: this.id, baseUrl: this.baseUrl }, async (stream) => {
      debug('piping stream to pipeline');
      const transformed = await stream.pipe(pipeline);
      debug('converting to buffer');
      return await transformed.toBuffer();
    });
    debug('returning %d bytes', result.length);
    return { contentType: mime.lookup(this.format), body: result };
  }

  async execute () {
    if (this.filename === 'info.json') {
      return await this.infoJson();
    } else {
      return await this.iiifImage();
    }
  }
}

module.exports = { Processor, IIIFError };
