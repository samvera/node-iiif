import sharp, { Sharp } from 'sharp';

declare class IIIFError extends Error {
    statusCode?: number;
    constructor(message: string, opts?: {
        statusCode?: number;
    });
}

type BoundingBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};
type Dimensions = {
    width: number;
    height: number;
};
type Format = 'jpg' | 'jpeg' | 'tif' | 'tiff' | 'png' | 'webp';
type MaxDimensions = {
    width?: number;
    height?: number;
    area?: number;
};
type Quality = 'color' | 'gray' | 'bitonal' | 'default';

interface Calculated {
    region: BoundingBox;
    size: Dimensions & {
        fit?: 'fill' | 'inside';
    };
    rotation: {
        flop: boolean;
        degree: number;
    };
    quality: Quality;
    format: {
        type: Format;
        density?: number;
    };
    fullSize: Dimensions;
}
interface CalculatorLike {
    region(s: string): this;
    size(s: string): this;
    rotation(s: string): this;
    quality(q: string): this;
    format(f: string, density?: number): this;
    info(): Calculated;
    canonicalPath(): string;
}
type CalculatorCtor = {
    new (dims: Dimensions, opts?: {
        max?: MaxDimensions;
    }): CalculatorLike;
    parsePath(path: string): any;
};
interface InfoDocInput {
    id: string;
    width: number;
    height: number;
    sizes: Dimensions[];
    max?: MaxDimensions;
}
type InfoDoc = Record<string, unknown>;
interface VersionModule {
    profileLink: string;
    infoDoc(input: InfoDocInput): InfoDoc;
    Calculator: CalculatorCtor;
}

declare class Operations {
    private keepMetadata?;
    private pages;
    private sharpOptions?;
    private calculator;
    private pageThreshold;
    constructor(version: number, dims: Dimensions[], opts: any);
    region(v: string): this;
    size(v: string): this;
    rotation(v: string): this;
    quality(v: string): this;
    format(v: string, density?: number): this;
    info(): Calculated;
    canonicalPath(): string;
    withMetadata(v: boolean): this;
    private computePage;
    pipeline(): Sharp;
}

type StreamResolver = (input: {
    id: string;
    baseUrl: string;
}) => Promise<NodeJS.ReadableStream>;
type StreamResolverWithCallback = (input: {
    id: string;
    baseUrl: string;
}, callback: (stream: NodeJS.ReadableStream) => Promise<unknown>) => Promise<unknown>;
declare class Processor {
    private errorClass;
    private Implementation;
    private sizeInfo?;
    private sharpOptions?;
    id: string;
    baseUrl: string;
    version: 2 | 3;
    request: string;
    streamResolver: StreamResolver | StreamResolverWithCallback;
    filename?: string;
    info?: string;
    region: string;
    size: string;
    rotation: string;
    quality: string;
    format: string;
    dimensionFunction: (input: {
        id: string;
        baseUrl: string;
    }) => Promise<Dimensions | Dimensions[]>;
    max?: MaxDimensions;
    includeMetadata: boolean;
    density?: number | null;
    debugBorder: boolean;
    pageThreshold?: number;
    constructor(url: string, streamResolver: StreamResolver | StreamResolverWithCallback, opts?: any);
    setOpts(opts: any): this;
    initialize(streamResolver: any): this;
    withStream({ id, baseUrl }: {
        id: string;
        baseUrl: string;
    }, callback: (s: NodeJS.ReadableStream) => Promise<any>): Promise<any>;
    defaultDimensionFunction({ id, baseUrl }: {
        id: string;
        baseUrl: string;
    }): Promise<Dimensions[]>;
    dimensions(): Promise<Dimensions[]>;
    infoJson(): Promise<{
        readonly contentType: "application/json";
        readonly body: string;
    }>;
    operations(dim: Dimensions[]): Operations;
    applyBorder(transformed: any): Promise<sharp.Sharp>;
    iiifImage(): Promise<{
        canonicalLink: string;
        profileLink: string;
        contentType: string;
        body: Buffer;
    }>;
    execute(): Promise<{
        readonly contentType: "application/json";
        readonly body: string;
    } | {
        canonicalLink: string;
        profileLink: string;
        contentType: string;
        body: Buffer;
    }>;
}

declare const Versions: Record<2 | 3, VersionModule>;

export { IIIFError, Processor, Versions };
