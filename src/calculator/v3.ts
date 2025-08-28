import { CalculatorOptions } from '../contracts';
import { Base, ValidatorMap } from './base';

export class Calculator extends Base {
  static _matchers (): ValidatorMap {
    const result: ValidatorMap = { ...super._matchers() };
    result.size = [...result.size].reduce((sizes: string[], pattern: string) => {
      if (pattern !== 'full') sizes.push(`\\^?${pattern}`);
      return sizes;
    }, [] as string[]);
    return result;
  }

  constructor (dims: { width: number; height: number }, opts: CalculatorOptions = {}) {
    super(dims, opts);
    this._canonicalInfo.size = 'max';
    this._parsedInfo.upscale = false;
  }

  size (v: string) {
    if (v[0] === '^') {
      this._parsedInfo.upscale = true;
      v = v.slice(1, v.length);
    }
    return super.size(v);
  }
}

export * from './base';

export default { Calculator };
