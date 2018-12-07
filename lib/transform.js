const Sharp     = require('sharp');
const IIIFError = require('./error');

const Formats    = ["jpg", "tif", "gif", "png"];
const Qualities  = ["color", "gray", "bitonal", "default"]
const IR         = '\\d+';           // Integer RegEx
const FR         = '\\d+(?:\.\\d+)?' // Float RegEx
const Validators = {
  quality: Qualities,
  format: Formats,
  region: ['full', 'square', `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ['full', 'max', `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: `\\!?${FR}`
}

function validator(type) {
  var result = Validators[type];
  if (result instanceof Array) {
    result = result.join('|');
  }
  return new RegExp('^(' + result + ')$');
}

function validate(type, v) {
  if (!validator(type).test(v)) { 
    throw new IIIFError(`Invalid ${type}: ${v}`);
  }
  return true;
}

function noOp() {
  return null;
}

function regionSquare(dims) {
  if (dims.width == dims.height) {
    return noOp();
  } else {
    var side = Math.min(dims.width, dims.height);
    var params = { width: side, height: side };
    var offset = Math.abs(Math.floor((dims.width - dims.height) / 2));
    if (dims.width > dims.height) {
      params.left = offset;
      params.top  = 0;
    } else {
      params.left = 0;
      params.top  = offset;
    }
    return Sharp().extract(params);
  }
}

function regionPct(v, dims) {
  console.log('regionPct', v);
  var x, y, w, h;
  [x, y, w, h] = v.split(/\s*,\s*/).map(pct => { return (Number(pct) / 100.0) });
  [x, w] = [x, w].map(val => Math.round(dims.width * val) );
  [y, h] = [y, h].map(val => Math.round(dims.height * val) );
  return regionXYWH([x, y, w, h])
}

function regionXYWH(v) {
  console.log('regionXYWH', v);
  if (typeof v == 'string') {
    v = v.split(/\s*,\s*/).map(val => Number(val));
  }
  var params = { left: v[0], top: v[1], width: v[2], height: v[3] };
  if (params.width == 0 || params.height == 0) {
    throw new IIIFError(`Region width and height must both be > 0`);
  }
  return Sharp().extract(params);
}

function sizePct(v, dims) {
  console.log('sizePct', v);
  var pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw new IIIFError(`Invalid resize %: ${v}`);
  }
  var width = Math.round(dims.width * (pct / 100.0));
  return sizeWH(`${width},`)
}

function sizeWH(v) {
  console.log('sizeWH', v);
  var params = { fit: 'inside' };
  if (typeof v == 'string') {
    if (v[0] == '!') {
      params.fit = 'fill';
    }
    v = v.replace(/^!/,'').split(/\s*,\s*/).map(val => val == '' ? null : Number(val));
  }
  [params.width, params.height] = v;
  if (params.width == 0 || params.height == 0) {
    throw new IIIFError(`Resize width and height must both be > 0`);
  }
  return Sharp().resize(params);
}

class Operations {
  constructor(dims) {
    this.dims = dims;
  }

  region(v) { 
    validate('region', v);

    var result;
    if (v == 'full') {
      result = noOp();
    } else if (v == 'square') {
      result = regionSquare(this.dims);
    } else if (v.match(/^pct:([\d,]+)/)) {
      result = regionPct(RegExp.$1, this.dims);
    } else {
      result = regionXYWH(v);
    }
    if (result instanceof Sharp) {
      this.dims.width = result.options.widthPre;
      this.dims.height = result.options.heightPre;
    }
    return result;
  }
  
  size(v) {
    validate('size', v);

    if (v == 'full' || v == 'max') {
      return noOp();
    } else if (v.match(/^pct:([\d]+)/)) {
      return sizePct(RegExp.$1, this.dims);
    } else {
      return sizeWH(v);
    }
  }
  
  rotation(v) {
    validate('rotation', v);

    if (v == '0') {
      return noOp();
    }
  
    var transformer = Sharp();
    if (v[0] == '!') {
      transformer = transformer.flop();
    }
    var value = Number(v.replace(/^!/, ''));
    if (isNaN(value)) {
      throw new IIIFError(`Invalid rotation value: ${v}`);
    }
    return transformer.rotate(value);
  }
  
  quality(v) {
    validate('quality', v);
    if (v == 'color' || v == 'default') {
      return noOp();
    } else if (v == 'gray') {
      return Sharp().grayscale();
    } else if (v == 'bitonal') {
      return Sharp().threshold();
    }
  }
  
  format(v) {
    validate('format', v);
    return Sharp().toFormat(v);
  }
}

module.exports = { Operations, Qualities, Formats, IIIFError }
