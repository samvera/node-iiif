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
export type ResolvedDimensions = Dimensions | Dimensions[];

export type Format = 'jpg' | 'jpeg' | 'tif' | 'tiff' | 'png' | 'webp';

export type IIIFSpec = {
  id: string;
  info?: boolean;
  region?: string;
  size?: string;
  rotation?: string;
  quality?: string;
  format?: string;
  density?: number;
};

export type MaxDimensions = {
  width?: number;
  height?: number;
  area?: number;
};

export type Quality = 'color' | 'gray' | 'bitonal' | 'default';

export type ContentResult = {
  canonicalLink?: string;
  profileLink?: string;
  contentType: string;
  body: Buffer | string;
};

export type RedirectResult = {
  location: string;
  redirect: boolean;
};

export type ErrorResult = {
  error: boolean;
  message: string;
  statusCode: number;
  location?: undefined;
  redirect?: undefined;
};

export type ProcessorResult = ContentResult | RedirectResult | ErrorResult;