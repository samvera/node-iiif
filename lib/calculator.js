const IIIFError = require('./error');
const debug = require('debug')('iiif-processor:calculator');

// Integer RegEx
const IR = '\\d+';
// Float RegEx
const FR = '\\d+(?:\.\\d+)?'; // eslint-disable-line no-useless-escape

const Validators = {
  quality: ['color', 'gray', 'bitonal', 'default'],
  format: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
  region: ['full', 'square', `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ['full', 'max', `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: `\\!?${FR}`
};

function validator (type) {
  let result = Validators[type];
  if (result instanceof Array) {
    result = result.join('|');
  }
  return `(?<${type}>${result})`;
}

function validate (type, v) {
  debug('validating %s %s', type, v);
  const re = new RegExp(`^${validator(type)}$`);
  if (!re.test(v)) {
    throw new IIIFError(`Invalid ${type}: ${v}`);
  }
  return true;
}

function validateDensity (v) {
  debug('validating density %s', v);
  if (v === null) return true;
  if (v === undefined) return true;
  if (typeof v !== 'number' || v < 0) {
    throw new IIIFError(`Invalid density value: ${v}`);
  }
  return true;
}

function iiifRegExp () {
  const transformation =
    ['region', 'size', 'rotation'].map(type => validator(type)).join('/') +
    '/' + validator('quality') + '.' + validator('format');

  return new RegExp(`^/?(?<id>.+?)/(?:(?<info>info.json)|${transformation})$`);
}

class Calculator {
  #parsedInfo;
  #sourceDims;

  constructor (dims) {
    this.dims = { ...dims };
    this.#sourceDims = { ...dims };
    this.#parsedInfo = {
      region: { left: 0, top: 0, ...dims },
      size: { ...dims },
      rotation: { flop: false, degree: 0 },
      quality: 'default',
      format: { type: 'jpg' },
      fullSize: { ...dims }
    };
  }

  region (v) {
    validate('region', v);

    if (v === 'full') {
      this.#parsedInfo.region = { left: 0, top: 0, ...this.dims };
    } else if (v === 'square') {
      this.#parsedInfo.region = regionSquare(this.dims);
    } else if (v.match(/^pct:([\d.,]+)/)) {
      this.#parsedInfo.region = regionPct(RegExp.$1, this.dims);
    } else {
      this.#parsedInfo.region = regionXYWH(v);
    }
    this.#parsedInfo.fullSize = fullSize(this.#sourceDims, this.#parsedInfo);
    return this;
  }

  size (v) {
    validate('size', v);

    if (v === 'full' || v === 'max') {
      this.#parsedInfo.size = this.dims;
    } else if (v.match(/^pct:([\d]+)/)) {
      this.#parsedInfo.size = sizePct(RegExp.$1, this.dims);
    } else {
      this.#parsedInfo.size = sizeWH(v);
    }
    this.#parsedInfo.fullSize = fullSize(this.#sourceDims, this.#parsedInfo);
    return this;
  }

  rotation (v) {
    validate('rotation', v);

    if (v === '0') {
      return this;
    }

    this.#parsedInfo.rotation = {
      flop: v[0] === '!',
      degree: Number(v.replace(/^!/, ''))
    };
    return this;
  }

  quality (v) {
    validate('quality', v);
    this.#parsedInfo.quality = v;
    return this;
  }

  format (v, density) {
    validate('format', v);
    validateDensity(density);
    this.#parsedInfo.format = { type: v, density };
    return this;
  }

  info () {
    return this.#parsedInfo;
  }
}

function findProportion (original, actual, missing) {
  return (actual / original) * missing;
}

function fullSize (dims, { region, size }) {
  const height = size.height || findProportion(dims.width, size.width, dims.height);
  const width = size.width || findProportion(dims.height, size.height, dims.width);
  const regionPct = { width: region.width / dims.width, height: region.height / dims.height };
  return { width: Math.floor(width / regionPct.width), height: Math.floor(height / regionPct.height) };
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
    throw new IIIFError('Region width and height must both be > 0');
  }
  return result;
}

function sizePct (v, dims) {
  const pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw new IIIFError(`Invalid resize %: ${v}`);
  }
  const width = Math.floor(dims.width * (pct / 100.0));
  return sizeWH(`${width},`);
}

function sizeWH (v) {
  const result = { fit: 'cover' };
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
    throw new IIIFError('Resize width and height must both be > 0');
  }
  return result;
}

function pathToIiif (path) {
  const re = iiifRegExp();
  const result = re.exec(path)?.groups;
  if (!result) throw new IIIFError(`Not a valid IIIF path: ${path}`);
  return result;
}

module.exports = {
  Calculator,
  Qualities: Validators.quality,
  Formats: Validators.format,
  pathToIiif
};
