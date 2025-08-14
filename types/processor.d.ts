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
  input: { id: string, baseUrl: string }
) => Promise<NodeJS.ReadableStream>;

/**
 * @deprecated Use the Promise-based `StreamResolver` instead. This callback form
 *             will be removed in a future major version.
 */
export type StreamResolverWithCallback = (
  input: { id: string, baseUrl: string },
  callback: (result: NodeJS.ReadableStream) => Promise<unknown>
) => Promise<unknown>;

export declare class Processor {
  constructor(
    url: string,
    streamResolver: StreamResolver | StreamResolverWithCallback,
    opts?: {
      dimensionFunction?: DimensionFunction;
      max?: MaxDimensions;
      includeMetadata?: boolean;
      density?: number;
      pathPrefix?: string;
      iiifVersion?: 2 | 3;
      debugBorder?: boolean;
      pageThreshold?: number;
      sharpOptions?: Record<string, unknown>;
    }
  );

  execute(): Promise<InfoJson | IiifImage>;
}
