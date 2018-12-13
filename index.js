const probe      = require('probe-image-size');
const mime       = require('mime-types');
const transform  = require('./lib/transform');
const IIIFError  = require('./lib/error');

const filenameRe = new RegExp('(color|gray|bitonal|default)\.(jpg|tif|gif|png)');

function parseUrl(url) {
  var result = {};
  var segments = url.split('/');
  result.filename = segments.pop();
  if (result.filename.match(filenameRe)) {
    result.rotation   = segments.pop();
    result.size       = segments.pop();
    result.region     = segments.pop();
    result.quality    = RegExp.$1;
    result.format     = RegExp.$2;
  }
  result.id = decodeURIComponent(segments.pop());
  result.baseUrl = segments.join('/');
  return result;
}

class Processor {
  constructor(params, streamResolver) {
    if (typeof params == 'string') {
      params = parseUrl(params);
    }
    Object.assign(this, params);
    this.filename = [this.quality, this.format].join('.');
    this.streamResolver = streamResolver;
    this.errorClass = IIIFError;
    if (!filenameRe.test(this.filename) && this.filename != 'info.json') {
      throw new this.errorClass(`Invalid IIIF URL: ${url}`);
    }
  }
  
  dimensions() {
    if (this.sizeInfo == null) {
      this.sizeInfo = probe(this.streamResolver(this.id)).then(data => this.sizeInfo = data);
    }
    return this.sizeInfo;
  }

  async infoJson() {
    var dim = await this.dimensions();
    var sizes = [];
    for(var size = [dim.width, dim.height]; size.every(x => x >= 128); size = size.map(x => Math.floor(x/2))) {
      sizes.push({ width: size[0], height: size[1] });
    }

    var doc = {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": [this.baseUrl, encodeURIComponent(this.id)].join('/'),
      protocol: "http://iiif.io/api/image",
      width: dim.width,
      height: dim.height,
      sizes: sizes,
      tiles: [
        { 
          width: 512, 
          height: 512,
          scaleFactors: sizes.map((_v, i) => 2**i)
        }
      ],
      profile: ["http://iiif.io/api/image/2/level2.json", {
        formats: transform.Formats,
        qualities: transform.Qualities,
        supports: ["regionByPx", "sizeByW", "sizeByWhListed", "cors", "regionSquare", "sizeByDistortedWh", "sizeAboveFull", "canonicalLinkHeader", "sizeByConfinedWh", "sizeByPct", "jsonldMediaType", "regionByPct", "rotationArbitrary", "sizeByH", "baseUriRedirect", "rotationBy90s", "profileLinkHeader", "sizeByForcedWh", "sizeByWh", "mirroring"]
      }]
    }

    return { contentType: 'application/json', body: JSON.stringify(doc) };
  }
  
  async iiifImage() {
    try {
      var dim = await this.dimensions();
      var pipeline = new transform.Operations(dim)
        .region(this.region)
        .size(this.size)
        .rotation(this.rotation)
        .quality(this.quality)
        .format(this.format)
        .pipeline

      var result = await this.streamResolver(this.id)
        .pipe(pipeline)
        .toBuffer();
      return { contentType: mime.lookup(this.format), body: result };
    } catch(err) {
      throw new IIIFError(`Unhandled transformation error: ${err.message}`);
    }
  }
  
  async execute() {
    try {
      if (this.filename == 'info.json') {
        return this.infoJson();
      } else {
        return this.iiifImage();
      }
    } catch(err) {
      console.log('Caught while executing', err.message);
    }
  }
}

module.exports = { Processor, IIIFError };