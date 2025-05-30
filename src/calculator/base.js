const IIIFError = require('../error');
const debug = require('debug')('iiif-processor:calculator');

// Integer RegEx
const IR = '\\d+';
// Float RegEx
const FR = '\\d+(?:\.\\d+)?'; // eslint-disable-line no-useless-escape
// Percent Regex
const PCTR = /^pct:(?<val>[\d.,]+)/;

const Validators = {
  quality: ['color', 'gray', 'bitonal', 'default'],
  format: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
  region: ['full', 'square', `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ['full', 'max', `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: [`\\!?${FR}`]
};

function validateDensity (v) {
  debug('validating density %s', v);
  if (v === null) return true;
  if (v === undefined) return true;
  if (typeof v !== 'number' || v < 0) {
    throw new IIIFError(`Invalid density value: ${v}`);
  }
  return true;
}

class Base {
  _canonicalInfo;
  _parsedInfo;
  _sourceDims;

  static _matchers () {
    return Validators;
  }

  static _validator (type) {
    const result = this._matchers()[type].join('|');
    return `(?<${type}>${result})`;
  }

  static parsePath (path) {
    const transformation =
      ['region', 'size', 'rotation'].map(type => this._validator(type)).join('/') +
      '/' + this._validator('quality') + '.' + this._validator('format');

    const re = new RegExp(`^/?(?<id>.+?)/(?:(?<info>info.json)|${transformation})$`);
    const result = re.exec(path)?.groups;
    if (!result) throw new IIIFError(`Not a valid IIIF path: ${path}`, { statusCode: 400 });
    return result;
  }

  constructor (dims, opts) {
    this.dims = { ...dims };
    this.opts = { ...opts };
    this._sourceDims = { ...dims };
    this._canonicalInfo = {
      region: 'full',
      size: 'full',
      rotation: '0',
      quality: 'default',
      format: 'jpg'
    };
    this._parsedInfo = {
      region: { left: 0, top: 0, ...dims },
      size: { ...dims },
      rotation: { flop: false, degree: 0 },
      quality: 'default',
      format: { type: 'jpg' },
      upscale: true
    };
  }

  _validate (type, v) {
    if (type === 'density') return validateDensity(v);
    const re = new RegExp(`^${this.constructor._validator(type)}$`);

    debug('validating %s %s against %s', type, v, re);

    if (!re.test(v)) {
      throw new IIIFError(`Invalid ${type}: ${v}`, { statusCode: 400 });
    }
    return true;
  }

  region (v) {
    this._validate('region', v);
    const pct = PCTR.exec(v);
    let isFull = false;

    if (v === 'full') {
      this._parsedInfo.region = { left: 0, top: 0, ...this.dims };
      isFull = true;
    } else if (v === 'square') {
      this._parsedInfo.region = regionSquare(this.dims);
    } else if (pct) {
      this._parsedInfo.region = regionPct(pct.groups.val, this.dims);
    } else {
      this._parsedInfo.region = regionXYWH(v);
    }
    this._canonicalInfo.region = isFull ? 'full' : this._parsedInfo.region;
    this._constrainRegion();
    return this;
  }

  size (v) {
    this._validate('size', v);

    const pct = PCTR.exec(v);
    let isMax = false;

    if (['full', 'max'].includes(v)) {
      this._setSize(this._parsedInfo.region);
      isMax = true;
    } else if (pct) {
      this._setSize(sizePct(pct.groups.val, this._parsedInfo.region));
    } else {
      this._setSize(sizeWH(v));
    }

    this._canonicalInfo.size = isMax ? v : this._canonicalSize();
    return this;
  }

  rotation (v) {
    this._validate('rotation', v);
    this._canonicalInfo.rotation = v;
    this._parsedInfo.rotation = {
      flop: v[0] === '!',
      degree: Number(v.replace(/^!/, ''))
    };

    return this;
  }

  quality (v) {
    this._validate('quality', v);
    this._canonicalInfo.quality = v;
    this._parsedInfo.quality = v;
    return this;
  }

  format (v, density) {
    this._validate('format', v);
    this._validate('density', density);
    this._canonicalInfo.format = v;
    this._parsedInfo.format = { type: v, density };
    return this;
  }

  info () {
    return {
      ...this._parsedInfo,
      fullSize: fullSize(this._sourceDims, this._parsedInfo)
    };
  }

  canonicalPath () {
    const { region, size, rotation, quality, format } = this._canonicalInfo;
    return `${region}/${size}/${rotation}/${quality}.${format}`;
  }

  _setSize (v) {
    const max = { ...this.opts.max };
    max.height = max.height || max.width;
    this._parsedInfo.size = { ...v };

    // Make sure size doesn't violate configured maximums
    this._constrainSize(max);

    // v3: Make sure size doesn't violate upscaling rules
    if (!this._parsedInfo.upscale) {
      this._constrainSize(this._sourceDims);
    }

    return this;
  }

  _constrainSize (constraints) {
    const full = fullSize(this._sourceDims, this._parsedInfo);
    const constraint = minNum(
      constraints.width / full.width,
      constraints.height / full.height,
      constraints.area / (full.width * full.height)
    );
    if (constraint < 1) {
      if (this._parsedInfo.size.width) {
        this._parsedInfo.size.width = Math.floor(this._parsedInfo.size.width * constraint);
      }
      if (this._parsedInfo.size.height) {
        this._parsedInfo.size.height = Math.floor(this._parsedInfo.size.height * constraint);
      }
    }
  }

  _canonicalSize () {
    const { width, height } = this._parsedInfo.size;
    const result = (width?.toString() || '') + ',' + (height?.toString() || '');
    return this._parsedInfo.size.fit === 'inside' ? `!${result}` : result;
  }

  _constrainRegion () {
    let { left, top, width, height } = this._parsedInfo.region;
    left = Math.max(left, 0);
    top = Math.max(top, 0);
    if (left > this.dims.width || top > this.dims.height) {
      throw new IIIFError('Region is out of bounds', { statusCode: 400 });
    }
    width = Math.min(width, this.dims.width - left);
    height = Math.min(height, this.dims.height - top);
    this._parsedInfo.region = { left, top, width, height };
  }
}

function minNum (...args) {
  const nums = args.filter((arg) => typeof arg === 'number' && !isNaN(arg));
  return Math.min(...nums);
}

function fullSize (dims, { region, size }) {
  const regionAspect = region.width / region.height;

  if (!size.width && !size.height) {
    throw new IIIFError('Must specify at least one of width or height', { statusCode: 400 });
  }

  if (!size.height) size.height = Math.floor(size.width / regionAspect);
  if (!size.width) size.width = Math.floor(size.height * regionAspect);

  const scaleFactor = size.width / region.width;
  const result = {
    width: Math.floor(dims.width * scaleFactor),
    height: Math.floor(dims.height * scaleFactor)
  };

  debug('Region %j at size %j yields full size %j, a scale factor of %f', region, size, result, scaleFactor);

  return result;
}

function regionSquare (dims) {
  let result = { left: 0, top: 0, ...dims };

  if (dims.width !== dims.height) {
    const side = Math.min(dims.width, dims.height);
    result = { ...result, width: side, height: side };
    const offset = Math.abs(Math.floor((dims.width - dims.height) / 2));
    if (dims.width > dims.height) {
      result.left = offset;
      result.top = 0;
    } else {
      result.left = 0;
      result.top = offset;
    }
  }
  return result;
}

function regionPct (v, dims) {
  let x, y, w, h;
  [x, y, w, h] = v.split(/\s*,\s*/).map((pct) => {
    return Number(pct) / 100.0;
  });
  [x, w] = [x, w].map((val) => Math.floor(dims.width * val));
  [y, h] = [y, h].map((val) => Math.floor(dims.height * val));
  return regionXYWH([x, y, w, h]);
}

function regionXYWH (v) {
  if (typeof v === 'string') {
    v = v.split(/\s*,\s*/).map((val) => Number(val));
  }
  const result = { left: v[0], top: v[1], width: v[2], height: v[3] };
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError('Region width and height must both be > 0', { statusCode: 400 });
  }
  return result;
}

function sizePct (v, dims) {
  const pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw new IIIFError(`Invalid resize %: ${v}`, { statusCode: 400 });
  }
  const width = Math.floor(dims.width * (pct / 100.0));
  return sizeWH(`${width},`);
}

function sizeWH (v) {
  const result = { fit: 'fill' };
  if (typeof v === 'string') {
    if (v[0] === '!') {
      result.fit = 'inside';
    }
    v = v
      .replace(/^!/, '')
      .split(/\s*,\s*/)
      .map((val) => (val === '' ? null : Number(val)));
  }
  [result.width, result.height] = v;
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError('Resize width and height must both be > 0', { statusCode: 400 });
  }
  return result;
}

module.exports = {
  Base,
  Qualities: Validators.quality,
  Formats: Validators.format
};
