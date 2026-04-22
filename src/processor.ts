import Debug from 'debug';
import mime from 'mime-types';
import path from 'path';
import sharp from 'sharp';
import { calculateGeometry, readGeometry } from './geometry';
import { Operations } from './transform';
import { IIIFError } from './error';
import Versions from './versions';
import type {
  MaxDimensions,
  ImageGeometry,
  ProcessorResult,
  ContentResult,
  ErrorResult,
  RedirectResult
} from './types';
import type { VersionModule } from './contracts';

const debug = Debug('iiif-processor:main');
const debugv = Debug('verbose:iiif-processor');

const defaultpathPrefix = '/iiif/{{version}}/';

function getIiifVersion(url: string, template: string) {
  const { origin, pathname } = new URL(url);
  const templateMatcher = template.replace(
    /\{\{version\}\}/,
    '(?<iiifVersion>\\d+)'
  );
  const pathMatcher = `^(?<prefix>${templateMatcher})(?<request>.+)$`;
  const re = new RegExp(pathMatcher);
  const parsed = re.exec(pathname);
  if (parsed) {
    parsed.groups.prefix = origin + parsed.groups.prefix;
    return { ...parsed.groups } as {
      prefix: string;
      iiifVersion: string;
      request: string;
    };
  } else {
    throw new IIIFError('Invalid IIIF path');
  }
}

export type GeometryFunction = (input: {
  id: string;
  baseUrl: string;
}) => Promise<ImageGeometry>;
export type StreamResolver = (input: {
  id: string;
  baseUrl: string;
}) => Promise<NodeJS.ReadableStream>;
export type StreamResolverWithCallback = (
  input: { id: string; baseUrl: string },
  callback: (stream: NodeJS.ReadableStream) => Promise<unknown>
) => Promise<unknown>;
export type ProcessorOptions = {
  geometryFunction?: GeometryFunction;
  max?: { width: number; height?: number; area?: number };
  includeMetadata?: boolean;
  density?: number;
  debugBorder?: boolean;
  iiifVersion?: number;
  pageThreshold?: number;
  pathPrefix?: string;
  sharpOptions?: Record<string, unknown>;
  request?: string;
};

export class Processor {
  private errorClass = IIIFError;
  private Implementation!: VersionModule;
  private imageGeometry?: ImageGeometry;
  private sharpOptions?: Record<string, unknown>;

  id!: string;
  baseUrl!: string;
  version!: number;
  request!: string;
  streamResolver!: StreamResolver | StreamResolverWithCallback;
  filename?: string;

  // parsed params from Calculator.parsePath
  info?: string;
  region!: string;
  size!: string;
  rotation!: string;
  quality!: string;
  format!: string;

  // options
  geometryFunction!: GeometryFunction;
  max?: MaxDimensions;
  includeMetadata = false;
  density?: number | null;
  debugBorder = false;
  pageThreshold?: number;

  constructor(
    url: string,
    streamResolver: StreamResolver | StreamResolverWithCallback,
    opts: ProcessorOptions = {}
  ) {
    const { prefix, iiifVersion, request } = getIiifVersion(
      url,
      opts.pathPrefix || defaultpathPrefix
    );

    if (typeof streamResolver !== 'function') {
      throw new IIIFError('streamResolver option must be specified');
    }

    if (opts.max?.height && !opts.max?.width) {
      throw new IIIFError('maxHeight cannot be specified without maxWidth');
    }

    const defaults = {
      geometryFunction: null,
      density: null
    };

    this.setOpts({
      ...defaults,
      iiifVersion,
      ...opts,
      prefix,
      request
    }).initialize(streamResolver);
  }

  setOpts(opts) {
    this.geometryFunction = opts.geometryFunction;
    this.max = { ...opts.max };
    this.includeMetadata = !!opts.includeMetadata;
    this.density = opts.density;
    this.baseUrl = opts.prefix;
    this.debugBorder = !!opts.debugBorder;
    this.pageThreshold = opts.pageThreshold;
    this.sharpOptions = { ...opts.sharpOptions };
    this.version = Number(opts.iiifVersion);
    this.request = opts.request;
    return this;
  }

  initialize(streamResolver: StreamResolver | StreamResolverWithCallback) {
    this.Implementation = Versions[this.version] as VersionModule;
    if (!this.Implementation) {
      throw new IIIFError(
        `No implementation found for IIIF Image API v${this.version}`
      );
    }

    const params = this.Implementation.Calculator.parsePath(this.request);
    debug('Parsed URL: %j', params);
    Object.assign(this, params);
    this.streamResolver = streamResolver;

    if (this.quality && this.format) {
      this.filename = [this.quality, this.format].join('.');
    } else if (this.info) {
      this.filename = 'info.json';
    }
    return this;
  }

  async withStream(
    { id, baseUrl }: { id: string; baseUrl: string },
    callback: (s: NodeJS.ReadableStream) => Promise<unknown>
  ) {
    debug('Requesting stream for %s', id);
    if (this.streamResolver.length === 2) {
      return await (this.streamResolver as StreamResolverWithCallback)(
        { id, baseUrl },
        callback
      );
    } else {
      const stream = await (this.streamResolver as StreamResolver)({
        id,
        baseUrl
      });
      return await callback(stream);
    }
  }

  async geometry(includeTile = false): Promise<ImageGeometry> {
    if (!this.imageGeometry) {
      debug(
        'Attempting to use geometryFunction to retrieve dimensions for %j',
        this.id
      );
      const params = { id: this.id, baseUrl: this.baseUrl };
      let geometry: ImageGeometry = {};
      if (this.geometryFunction) {
        geometry = await this.geometryFunction(params);
      }
      if (!(geometry.tileWidth && geometry.tileHeight) && !includeTile) {
        geometry.tileWidth = null;
        geometry.tileHeight = null;
      }
      geometry = await readGeometry(
        (callback) => this.withStream(params, callback),
        geometry
      );
      this.imageGeometry = calculateGeometry(geometry);
    }
    return this.imageGeometry;
  }

  async infoJson() {
    const geometry = await this.geometry(true);
    const uri = new URL(this.baseUrl);
    // Node's URL has readonly pathname in types; construct via join on new URL
    uri.pathname = path.join(uri.pathname, this.id);
    const id = uri.toString();
    const doc = this.Implementation.infoDoc({
      id,
      geometry,
      max: this.max
    });
    for (const prop in doc) {
      if (doc[prop] === null || doc[prop] === undefined) delete doc[prop];
    }

    const body = JSON.stringify(doc, (_key, value) =>
      value?.constructor === Set ? [...value] : value
    );
    return {
      type: 'content',
      contentType: 'application/ld+json',
      body
    } as ContentResult;
  }

  operations({ sizes }: ImageGeometry) {
    const sharpOpt = this.sharpOptions;
    const { max, pageThreshold } = this;
    debug('pageThreshold: %d', pageThreshold);
    return new Operations(this.version, sizes, {
      sharp: sharpOpt,
      max,
      pageThreshold
    })
      .region(this.region)
      .size(this.size)
      .rotation(this.rotation)
      .quality(this.quality)
      .format(this.format, this.density ?? undefined)
      .withMetadata(this.includeMetadata);
  }

  async applyBorder(transformed: sharp.Sharp) {
    const buf = await transformed.toBuffer();
    const borderPipe = sharp(buf, { limitInputPixels: false });
    const { width, height } = await borderPipe.metadata();
    const background = { r: 255, g: 0, b: 0, alpha: 1 };

    const topBorder = {
      create: { width, height: 1, channels: 4, background } as sharp.Create
    };
    const bottomBorder = {
      create: { width, height: 1, channels: 4, background } as sharp.Create
    };
    const leftBorder = {
      create: { width: 1, height, channels: 4, background } as sharp.Create
    };
    const rightBorder = {
      create: { width: 1, height, channels: 4, background } as sharp.Create
    };

    return borderPipe.composite([
      { input: topBorder, left: 0, top: 0 },
      { input: bottomBorder, left: 0, top: (height as number) - 1 },
      { input: leftBorder, left: 0, top: 0 },
      { input: rightBorder, left: (width as number) - 1, top: 0 }
    ]);
  }

  async iiifImage() {
    debugv('Request %s', this.request);
    const geometry = await this.geometry();
    const operations = this.operations(geometry);
    debugv('Operations: %j', operations);
    const pipeline = await operations.pipeline();

    const result = await this.withStream(
      { id: this.id, baseUrl: this.baseUrl },
      async (stream) => {
        debug('piping stream to pipeline');
        let transformed = await stream.pipe(pipeline);
        if (this.debugBorder) {
          transformed = await this.applyBorder(transformed);
        }
        debug('converting to buffer');
        return await transformed.toBuffer();
      }
    );
    debug('returning %d bytes', (result as Buffer).length);
    debug('baseUrl', this.baseUrl);

    const canonicalUrl = new URL(
      path.join(this.id, operations.canonicalPath()),
      this.baseUrl
    );
    return {
      type: 'content',
      canonicalLink: canonicalUrl.toString(),
      profileLink: this.Implementation.profileLink,
      contentType: mime.lookup(this.format) as string,
      body: result as Buffer
    } as ContentResult;
  }

  async execute(): Promise<ProcessorResult> {
    try {
      if (this.format === undefined && this.info === undefined) {
        debug('No format or info.json requested; redirecting to info.json');
        return {
          location: new URL(
            path.join(this.id, 'info.json'),
            this.baseUrl
          ).toString(),
          type: 'redirect'
        } as RedirectResult;
      }

      if (this.filename === 'info.json') {
        return await this.infoJson();
      }

      return await this.iiifImage();
    } catch (err) {
      if (err instanceof IIIFError) {
        debug('IIIFError caught: %j', err);
        return {
          type: 'error',
          message: err.message,
          statusCode: err.statusCode || 500
        } as ErrorResult;
      } else {
        throw err;
      }
    }
  }
}

export default Processor;
