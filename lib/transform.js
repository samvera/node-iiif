const Sharp = require('sharp');
const IIIFError = require('./error');

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
  const re = new RegExp(`^${validator(type)}$`);
  if (!re.test(v)) {
    throw new IIIFError(`Invalid ${type}: ${v}`);
  }
  return true;
}

function validateDensity (v) {
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

class Operations {
  constructor (dims) {
    this.dims = dims;
    this.pipeline = Sharp({ limitInputPixels: false });
  }

  region (v) {
    validate('region', v);

    if (v === 'full') {
      // do nothing
    } else if (v === 'square') {
      this._regionSquare(this.dims);
    } else if (v.match(/^pct:([\d.,]+)/)) {
      this._regionPct(RegExp.$1, this.dims);
    } else {
      this._regionXYWH(v);
    }

    const ifPositive = (a, b) => (a > 0 ? a : b);
    this.dims.width = ifPositive(this.pipeline.options.widthPre, this.dims.width);
    this.dims.height = ifPositive(this.pipeline.options.heightPre, this.dims.height);
    return this;
  }

  size (v) {
    validate('size', v);

    if (v === 'full' || v === 'max') {
      // do nothing
    } else if (v.match(/^pct:([\d]+)/)) {
      this._sizePct(RegExp.$1, this.dims);
    } else {
      this._sizeWH(v);
    }
    return this;
  }

  rotation (v) {
    validate('rotation', v);

    if (v === '0') {
      return this;
    }

    if (v[0] === '!') {
      this.pipeline = this.pipeline.flop();
    }
    const value = Number(v.replace(/^!/, ''));
    this.pipeline = this.pipeline.rotate(value);
    return this;
  }

  quality (v) {
    validate('quality', v);
    if (v === 'color' || v === 'default') {
      // do nothing
    } else if (v === 'gray') {
      this.pipeline = this.pipeline.grayscale();
    } else if (v === 'bitonal') {
      this.pipeline = this.pipeline.threshold();
    }
    return this;
  }

  format (v, density) {
    validate('format', v);
    validateDensity(density);

    let pipelineFormat;
    const pipelineOptions = {};

    switch (v) {
      case 'jpeg':
        pipelineFormat = 'jpg';
        break;
      case 'tif':
        pipelineFormat = 'tiff';
        if (density) {
          pipelineOptions.xres = density / 25.4;
          pipelineOptions.yres = density / 25.4;
        }
        break;
      default:
        pipelineFormat = v;
    }
    this.pipeline = this.pipeline.toFormat(pipelineFormat, pipelineOptions);
    if (density) {
      this.pipeline = this.pipeline.withMetadata({ density: density });
    }
    return this;
  }

  withMetadata (v) {
    if (v) this.pipeline = this.pipeline.withMetadata();
    return this;
  }

  _regionSquare (dims) {
    if (dims.width !== dims.height) {
      const side = Math.min(dims.width, dims.height);
      const params = { width: side, height: side };
      const offset = Math.abs(Math.floor((dims.width - dims.height) / 2));
      if (dims.width > dims.height) {
        params.left = offset;
        params.top = 0;
      } else {
        params.left = 0;
        params.top = offset;
      }
      this.pipeline = this.pipeline.extract(params);
    }
  }

  _regionPct (v, dims) {
    let x, y, w, h;
    [x, y, w, h] = v.split(/\s*,\s*/).map((pct) => {
      return Number(pct) / 100.0;
    });
    [x, w] = [x, w].map((val) => Math.round(dims.width * val));
    [y, h] = [y, h].map((val) => Math.round(dims.height * val));
    this._regionXYWH([x, y, w, h]);
  }

  _regionXYWH (v) {
    if (typeof v === 'string') {
      v = v.split(/\s*,\s*/).map((val) => Number(val));
    }
    const params = { left: v[0], top: v[1], width: v[2], height: v[3] };
    if (params.width === 0 || params.height === 0) {
      throw new IIIFError('Region width and height must both be > 0');
    }
    this.pipeline = this.pipeline.extract(params);
  }

  _sizePct (v, dims) {
    const pct = Number(v);
    if (isNaN(pct) || pct <= 0) {
      throw new IIIFError(`Invalid resize %: ${v}`);
    }
    const width = Math.round(dims.width * (pct / 100.0));
    this._sizeWH(`${width},`);
  }

  _sizeWH (v) {
    const params = { fit: 'cover' };
    if (typeof v === 'string') {
      if (v[0] === '!') {
        params.fit = 'inside';
      }
      v = v
        .replace(/^!/, '')
        .split(/\s*,\s*/)
        .map((val) => (val === '' ? null : Number(val)));
    }
    [params.width, params.height] = v;
    if (params.width === 0 || params.height === 0) {
      throw new IIIFError('Resize width and height must both be > 0');
    }
    this.pipeline = this.pipeline.resize(params);
  }
}

module.exports = {
  Qualities: Validators.quality,
  Formats: Validators.format,
  IIIFRegExp: iiifRegExp(),
  Operations,
  IIIFError
};
