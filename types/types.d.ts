export type BoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Dimensions = {
  width: number;
  height: number;
};

export type Format = 'jpg' | 'jpeg' | 'tif' | 'tiff' | 'png' | 'webp';

export type MaxDimensions = {
  width?: number;
  height?: number;
  area?: number;
};

export type Quality = 'color' | 'gray' | 'bitonal' | 'default';
