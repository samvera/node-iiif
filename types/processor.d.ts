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

export type DimensionFunction = (
  input: { id: string, baseUrl: string }
) => Promise<Dimensions | Array<Dimensions>>;

export type StreamResolver = (
  input: { id: string, baseUrl: string },
  callback?: (result: NodeJS.ReadableStream) => any
) => Promise<NodeJS.ReadableStream>;

export declare class Processor {
  constructor(
    url: string,
    streamResolver: StreamResolver,
    opts?: {
      dimensionFunction?: DimensionFunction;
      max?: MaxDimensions;
      includeMetadata?: boolean;
      density?: number;
      pathPrefix?: string;
      version?: 2 | 3;
    }
  );

  execute(): Promise<InfoJson | IiifImage>;
}