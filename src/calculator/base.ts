import Debug from 'debug';
import { IIIFError } from '../error';
import type { BoundingBox, Dimensions, MaxDimensions } from '../types';
import type { Calculated } from '../contracts';

const debug = Debug('iiif-processor:calculator');

const IR = '\\d+';
const FR = '\\d+(?:\\.\\d+)?';
const PCTR = /^pct:(?<val>[\d.,]+)/;

const Validators = {
  quality: ['color', 'gray', 'bitonal', 'default'],
  format: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
  region: ['full', 'square', `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ['full', 'max', `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: [`\\!?${FR}`]
};

type SizeDesc = { width?: number | null; height?: number | null; fit?: 'fill' | 'inside' };
type CanonicalInfo = { region: 'full' | BoundingBox; size: 'full' | 'max' | string; rotation: string; quality: string; format: string };
type ParsedInfo = { region: BoundingBox; size: SizeDesc; rotation: { flop: boolean; degree: number }; quality: string; format: { type: string; density?: number }; upscale: boolean };

function validateDensity (v: any) {
  debug('validating density %s', v);
  if (v === null) return true;
  if (v === undefined) return true;
  if (typeof v !== 'number' || v < 0) {
    throw new IIIFError(`Invalid density value: ${v}`);
  }
  return true;
}

export class Base {
  protected dims: Dimensions;
  protected opts: { max?: MaxDimensions };
  protected _canonicalInfo: CanonicalInfo;
  protected _parsedInfo: ParsedInfo;
  protected _sourceDims: Dimensions;

  static _matchers () {
    return Validators;
  }

  static _validator (type: keyof typeof Validators) {
    const result = (this._matchers() as any)[type].join('|');
    return `(?<${type}>${result})`;
  }

  static parsePath (path: string) {
    const transformation = ['region', 'size', 'rotation'].map((type) => (this as any)._validator(type)).join('/') + '/' + (this as any)._validator('quality') + '.' + (this as any)._validator('format');
    const re = new RegExp(`^/?(?<id>.+?)/(?:(?<info>info.json)|${transformation})$`);
    const result = (re.exec(path) as any)?.groups;
    if (!result) throw new IIIFError(`Not a valid IIIF path: ${path}`, { statusCode: 400 });
    return result;
  }

  constructor (dims: Dimensions, opts: { max?: MaxDimensions } = {}) {
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
      size: { width: dims.width, height: dims.height, fit: 'fill' },
      rotation: { flop: false, degree: 0 },
      quality: 'default',
      format: { type: 'jpg' },
      upscale: true
    };
  }

  protected _validate (type: string, v: unknown) {
    if (type === 'density') return validateDensity(v);
    const re = new RegExp(`^${(this.constructor as any)._validator(type)}$`);
    debug('validating %s %s against %s', type, v, re);
    if (!re.test(String(v))) {
      throw new IIIFError(`Invalid ${type}: ${v}`, { statusCode: 400 });
    }
    return true;
  }

  region (v: string) {
    this._validate('region', v);
    const pct = PCTR.exec(v);
    let isFull = false;
    if (v === 'full') {
      this._parsedInfo.region = { left: 0, top: 0, ...this.dims };
      isFull = true;
    } else if (v === 'square') {
      this._parsedInfo.region = regionSquare(this.dims);
    } else if (pct) {
      this._parsedInfo.region = regionPct(pct.groups?.val as string, this.dims);
    } else {
      this._parsedInfo.region = regionXYWH(v);
    }
    this._canonicalInfo.region = isFull ? 'full' : this._parsedInfo.region;
    this._constrainRegion();
    return this;
  }

  size (v: string) {
    this._validate('size', v);
    const pct = PCTR.exec(v);
    let isMax = false;
    if (['full', 'max'].includes(v)) {
      this._setSize(this._parsedInfo.region);
      isMax = true;
    } else if (pct) {
      this._setSize(sizePct(pct.groups?.val as string, this._parsedInfo.region));
    } else {
      this._setSize(sizeWH(v));
    }
    this._canonicalInfo.size = isMax ? v : this._canonicalSize();
    return this;
  }

  rotation (v: string) {
    this._validate('rotation', v);
    this._canonicalInfo.rotation = v;
    this._parsedInfo.rotation = { flop: v[0] === '!', degree: Number(v.replace(/^!/, '')) };
    return this;
  }

  quality (v: string) {
    this._validate('quality', v);
    this._canonicalInfo.quality = v;
    this._parsedInfo.quality = v;
    return this;
  }

  format (v: string, density?: number) {
    this._validate('format', v);
    this._validate('density', density);
    this._canonicalInfo.format = v;
    this._parsedInfo.format = { type: v, density };
    return this;
  }

  info (): Calculated {
    return { ...this._parsedInfo, fullSize: fullSize(this._sourceDims, this._parsedInfo as any) } as Calculated;
  }

  canonicalPath () {
    const { region, size, rotation, quality, format } = this._canonicalInfo;
    return `${region}/${size}/${rotation}/${quality}.${format}`;
  }

  protected _setSize (v: BoundingBox | SizeDesc) {
    const max: MaxDimensions = { ...(this.opts?.max || {}) };
    max.height = max.height || max.width;
    this._parsedInfo.size = (v as any).left !== undefined
      ? { width: (v as BoundingBox).width, height: (v as BoundingBox).height, fit: 'fill' }
      : { ...(v as SizeDesc) };
    this._constrainSize(max);
    if (!this._parsedInfo.upscale) {
      this._constrainSize(this._sourceDims);
    }
    return this;
  }

  protected _constrainSize (constraints: any) {
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

  protected _canonicalSize () {
    const { width, height } = this._parsedInfo.size;
    const result = (width?.toString() || '') + ',' + (height?.toString() || '');
    return this._parsedInfo.size.fit === 'inside' ? `!${result}` : result;
  }

  protected _constrainRegion () {
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

function minNum (...args: unknown[]) {
  const nums = args.filter((arg) => typeof arg === 'number' && !isNaN(arg));
  return Math.min(...(nums as number[]));
}

function fullSize (dims: Dimensions, { region, size }: { region: BoundingBox; size: { width?: number | null; height?: number | null; fit?: 'fill' | 'inside' } }) {
  const regionAspect = region.width / region.height;
  if (!size.width && !size.height) {
    throw new IIIFError('Must specify at least one of width or height', { statusCode: 400 });
  }
  if (!size.height && size.width != null) size.height = Math.floor((size.width as number) / regionAspect);
  if (!size.width && size.height != null) size.width = Math.floor((size.height as number) * regionAspect);
  const scaleFactor = (size.width as number) / region.width;
  const result = { width: Math.floor(dims.width * scaleFactor), height: Math.floor(dims.height * scaleFactor) };
  debug('Region %j at size %j yields full size %j, a scale factor of %f', region, size, result, scaleFactor);
  return result;
}

function regionSquare (dims: Dimensions): BoundingBox {
  let result: BoundingBox = { left: 0, top: 0, width: dims.width, height: dims.height };
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

function regionPct (v: string, dims: Dimensions): BoundingBox {
  let x: number, y: number, w: number, h: number;
  [x, y, w, h] = v.split(/\s*,\s*/).map((pct) => Number(pct) / 100.0) as [number, number, number, number];
  [x, w] = [x, w].map((val) => Math.floor(dims.width * val)) as [number, number];
  [y, h] = [y, h].map((val) => Math.floor(dims.height * val)) as [number, number];
  return regionXYWH([x, y, w, h]);
}

function regionXYWH (v: string | number[]): BoundingBox {
  const parts: number[] = typeof v === 'string' ? v.split(/\s*,\s*/).map((val) => Number(val)) : v;
  const result: BoundingBox = { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError('Region width and height must both be > 0', { statusCode: 400 });
  }
  return result;
}

function sizePct (v: string, dims: Dimensions) {
  const pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw new IIIFError(`Invalid resize %: ${v}`, { statusCode: 400 });
  }
  const width = Math.floor(dims.width * (pct / 100.0));
  return sizeWH(`${width},`);
}

function sizeWH (v: string | (number | null)[]) {
  const result: SizeDesc = { fit: 'fill' };
  let parts: (number | null)[];
  if (typeof v === 'string') {
    if (v[0] === '!') {
      result.fit = 'inside';
      v = v.slice(1);
    }
    parts = v.split(/\s*,\s*/).map((val) => (val === '' ? null : Number(val)));
  } else {
    parts = v;
  }
  [result.width, result.height] = parts as [number | null, number | null];
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError('Resize width and height must both be > 0', { statusCode: 400 });
  }
  return result;
}

export const Qualities = Validators.quality;
export const Formats = Validators.format;

export default { Base, Qualities, Formats };
