const { Base, ...passThrough } = require('./base');

class Calculator extends Base {
  static _matchers () {
    const result = { ...super._matchers() };
    // remove 'full' and add '^' upscale indicator to remaining options
    result.size = [...result.size].reduce((sizes, pattern) => {
      if (pattern !== 'full') sizes.push(`\\^?${pattern}`);
      return sizes;
    }, []);
    return result;
  }

  constructor (dims, opts) {
    super(dims, opts);
    this._canonicalInfo.size = 'max';
    this._parsedInfo.upscale = false;
  }

  size (v) {
    if (v[0] === '^') {
      this._parsedInfo.upscale = true;
      v = v.slice(1, v.length);
    }

    return super.size(v);
  }
}

module.exports = { Calculator, ...passThrough };
