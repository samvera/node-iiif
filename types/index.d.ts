import { Dimensions, MaxDimensions } from './types';
import { Calculator } from './calculator';

interface IIIFVersion {
  infoDoc: (params: {
    id: string;
    width: number;
    height: number;
    sizes: Array<Dimensions>;
    max?: MaxDimensions;
  }) => any;

  profileLink: string;
  Calculator: typeof Calculator;
  Qualities: string[];
  Formats: string[];
}

type IIIFVersions = Record<string, IIIFVersion>;

export declare class IIIFError extends Error {
  statusCode: number;

  constructor(
    message: string,
    opts: {
      statusCode?: number;
    }
  );
}

export { Processor } from './processor';

export declare const Versions: IIIFVersions;
