import { Dimensions, MaxDimensions } from './types';

export type IiifImage = {
  canonicalLink: string;
  profileLink: string;
  contentType: string;
  body: Buffer;
};

export type InfoJson = {
  contentType: 'application/json';
  body: string;
};

export declare class Processor {
  constructor(
    url: string,
    streamResolver: (id: string) => NodeJS.ReadableStream,
    opts?: {
      dimensionFunction?: (id: string) => Dimensions | Array<Dimensions>,
      max?: MaxDimensions,
      includeMetadata?: boolean,
      density?: number,
      pathPrefix?: string,
      version?: 2|3
    }
  );

  execute(): InfoJson | IiifImage;
}