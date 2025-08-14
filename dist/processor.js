"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Processor = void 0;
const debug_1 = __importDefault(require("debug"));
const mime_types_1 = __importDefault(require("mime-types"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const transform_1 = require("./transform");
const error_1 = require("./error");
const versions_1 = __importDefault(require("./versions"));
const debug = (0, debug_1.default)('iiif-processor:main');
const debugv = (0, debug_1.default)('verbose:iiif-processor');
const defaultpathPrefix = '/iiif/{{version}}/';
function getIiifVersion(url, template) {
    const { origin, pathname } = new URL(url);
    const templateMatcher = template.replace(/\{\{version\}\}/, '(?<iiifVersion>2|3)');
    const pathMatcher = `^(?<prefix>${templateMatcher})(?<request>.+)$`;
    const re = new RegExp(pathMatcher);
    const parsed = re.exec(pathname);
    if (parsed) {
        parsed.groups.prefix = origin + parsed.groups.prefix;
        return { ...parsed.groups };
    }
    else {
        throw new error_1.IIIFError('Invalid IIIF path');
    }
}
class Processor {
    constructor(url, streamResolver, opts = {}) {
        this.errorClass = error_1.IIIFError;
        this.includeMetadata = false;
        this.debugBorder = false;
        const { prefix, iiifVersion, request } = getIiifVersion(url, opts.pathPrefix || defaultpathPrefix);
        if (typeof streamResolver !== 'function') {
            throw new error_1.IIIFError('streamResolver option must be specified');
        }
        if (opts.max?.height && !opts.max?.width) {
            throw new error_1.IIIFError('maxHeight cannot be specified without maxWidth');
        }
        const defaults = {
            dimensionFunction: this.defaultDimensionFunction.bind(this),
            density: null
        };
        this
            .setOpts({ ...defaults, iiifVersion, ...opts, prefix, request })
            .initialize(streamResolver);
    }
    setOpts(opts) {
        this.dimensionFunction = opts.dimensionFunction;
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
    initialize(streamResolver) {
        this.Implementation = versions_1.default[this.version];
        if (!this.Implementation) {
            throw new error_1.IIIFError(`No implementation found for IIIF Image API v${this.version}`);
        }
        const params = this.Implementation.Calculator.parsePath(this.request);
        debug('Parsed URL: %j', params);
        Object.assign(this, params);
        this.streamResolver = streamResolver;
        if (this.quality && this.format) {
            this.filename = [this.quality, this.format].join('.');
        }
        else if (this.info) {
            this.filename = 'info.json';
        }
        return this;
    }
    async withStream({ id, baseUrl }, callback) {
        debug('Requesting stream for %s', id);
        if (this.streamResolver.length === 2) {
            return await this.streamResolver({ id, baseUrl }, callback);
        }
        else {
            const stream = await this.streamResolver({ id, baseUrl });
            return await callback(stream);
        }
    }
    async defaultDimensionFunction({ id, baseUrl }) {
        const result = [];
        let page = 0;
        const target = (0, sharp_1.default)({ limitInputPixels: false, page });
        return await this.withStream({ id, baseUrl }, async (stream) => {
            stream.pipe(target);
            const { width, height, pages } = await target.metadata();
            if (!width || !height || !pages)
                return result;
            result.push({ width, height });
            for (page += 1; page < pages; page++) {
                const scale = 1 / 2 ** page;
                result.push({ width: Math.floor(width * scale), height: Math.floor(height * scale) });
            }
            return result;
        });
    }
    async dimensions() {
        const fallback = this.dimensionFunction !== this.defaultDimensionFunction.bind(this);
        if (!this.sizeInfo) {
            debug('Attempting to use dimensionFunction to retrieve dimensions for %j', this.id);
            const params = { id: this.id, baseUrl: this.baseUrl };
            let dims = await this.dimensionFunction(params);
            if (fallback && !dims) {
                const warning = 'Unable to get dimensions for %s using custom function. Falling back to sharp.metadata().';
                debug(warning, this.id);
                console.warn(warning, this.id);
                dims = await this.defaultDimensionFunction(params);
            }
            if (!Array.isArray(dims))
                dims = [dims];
            this.sizeInfo = dims;
        }
        return this.sizeInfo;
    }
    async infoJson() {
        const [dim] = await this.dimensions();
        const sizes = [];
        for (let size = [dim.width, dim.height]; size.every((x) => x >= 64); size = size.map((x) => Math.floor(x / 2))) {
            sizes.push({ width: size[0], height: size[1] });
        }
        const uri = new URL(this.baseUrl);
        // Node's URL has readonly pathname in types; construct via join on new URL
        uri.pathname = path_1.default.join(uri.pathname, this.id);
        const id = uri.toString();
        const doc = this.Implementation.infoDoc({ id, ...dim, sizes, max: this.max });
        for (const prop in doc) {
            if (doc[prop] === null || doc[prop] === undefined)
                delete doc[prop];
        }
        const body = JSON.stringify(doc, (_key, value) => (value?.constructor === Set ? [...value] : value));
        return { contentType: 'application/json', body };
    }
    operations(dim) {
        const sharpOpt = this.sharpOptions;
        const { max, pageThreshold } = this;
        debug('pageThreshold: %d', pageThreshold);
        return new transform_1.Operations(this.version, dim, { sharp: sharpOpt, max, pageThreshold })
            .region(this.region)
            .size(this.size)
            .rotation(this.rotation)
            .quality(this.quality)
            .format(this.format, this.density ?? undefined)
            .withMetadata(this.includeMetadata);
    }
    async applyBorder(transformed) {
        const buf = await transformed.toBuffer();
        const borderPipe = (0, sharp_1.default)(buf, { limitInputPixels: false });
        const { width, height } = await borderPipe.metadata();
        const background = { r: 255, g: 0, b: 0, alpha: 1 };
        const topBorder = { create: { width, height: 1, channels: 4, background } };
        const bottomBorder = { create: { width, height: 1, channels: 4, background } };
        const leftBorder = { create: { width: 1, height, channels: 4, background } };
        const rightBorder = { create: { width: 1, height, channels: 4, background } };
        return borderPipe.composite([
            { input: topBorder, left: 0, top: 0 },
            { input: bottomBorder, left: 0, top: height - 1 },
            { input: leftBorder, left: 0, top: 0 },
            { input: rightBorder, left: width - 1, top: 0 }
        ]);
    }
    async iiifImage() {
        debugv('Request %s', this.request);
        const dim = await this.dimensions();
        const operations = this.operations(dim);
        debugv('Operations: %j', operations);
        const pipeline = await operations.pipeline();
        const result = await this.withStream({ id: this.id, baseUrl: this.baseUrl }, async (stream) => {
            debug('piping stream to pipeline');
            let transformed = await stream.pipe(pipeline);
            if (this.debugBorder) {
                transformed = await this.applyBorder(transformed);
            }
            debug('converting to buffer');
            return await transformed.toBuffer();
        });
        debug('returning %d bytes', result.length);
        debug('baseUrl', this.baseUrl);
        const canonicalUrl = new URL(path_1.default.join(this.id, operations.canonicalPath()), this.baseUrl);
        return {
            canonicalLink: canonicalUrl.toString(),
            profileLink: this.Implementation.profileLink,
            contentType: mime_types_1.default.lookup(this.format),
            body: result
        };
    }
    async execute() {
        if (this.filename === 'info.json') {
            return await this.infoJson();
        }
        else {
            return await this.iiifImage();
        }
    }
}
exports.Processor = Processor;
exports.default = Processor;
