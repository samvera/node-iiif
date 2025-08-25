import { Base } from './base';

export class Calculator extends Base {
  static _matchers () {
    const result: any = { ...(super._matchers() as any) };
    result.size = [...result.size].reduce((sizes: string[], pattern: string) => {
      if (pattern !== 'full') sizes.push(`\\^?${pattern}`);
      return sizes;
    }, [] as string[]);
    return result;
  }

  constructor (dims: { width: number; height: number }, opts: any = {}) {
    super(dims, opts);
    (this as any)._canonicalInfo.size = 'max';
    (this as any)._parsedInfo.upscale = false;
  }

  size (v: string) {
    if (v[0] === '^') {
      (this as any)._parsedInfo.upscale = true;
      v = v.slice(1, v.length);
    }
    return super.size(v);
  }
}

export * from './base';

export default { Calculator };
