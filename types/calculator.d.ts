import { BoundingBox, Dimensions, MaxDimensions, Quality, Format } from './types';

export type CalculatedImageSize = {
  region: BoundingBox;
  size: Dimensions;
  rotation: { flop: boolean; degree: number };
  quality: Quality;
  format: { type: Format };
  upscale: boolean;
  fullSize: Dimensions;
};

export declare class Calculator {
  static parsePath(path: string): {
    id: string,
    info: string,
    region: string,
    size: string,
    rotation: string,
    quality: string,
    format: string
  }

  constructor(
    dims: Dimensions,
    opts?: {
      max?: MaxDimensions
    }
  );

  region(v: string): Calculator;
  size(v: string): Calculator;
  rotation(v: string): Calculator;
  quality(v: Quality): Calculator;
  format(v: Format, density: number): Calculator;

  info(): CalculatedImageSize;
  canonicalPath(): string;
}