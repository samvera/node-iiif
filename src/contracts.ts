import type { BoundingBox, Dimensions, Format, IIIFSpec, MaxDimensions, Quality } from './types';

export interface Calculated {
  region: BoundingBox;
  size: Dimensions & { fit?: 'fill' | 'inside' };
  rotation: { flop: boolean; degree: number };
  quality: Quality;
  format: { type: Format; density?: number };
  fullSize: Dimensions;
}

export interface CalculatorLike {
  region(s: string): this;
  size(s: string): this;
  rotation(s: string): this;
  quality(q: string): this;
  format(f: string, density?: number): this;
  info(): Calculated;
  canonicalPath(): string;
}

export type CalculatorOptions = { max?: MaxDimensions };

export type CalculatorCtor = {
  new (dims: Dimensions, opts?: CalculatorOptions): CalculatorLike;
  parsePath(path: string): IIIFSpec | null;
};

export interface InfoDocInput {
  id: string;
  width: number;
  height: number;
  sizes: Dimensions[];
  max?: MaxDimensions;
}

export type InfoDoc = Record<string, unknown>;

export interface VersionModule {
  profileLink: string;
  infoDoc(input: InfoDocInput): InfoDoc;
  Calculator: CalculatorCtor;
}
