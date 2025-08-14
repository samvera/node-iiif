"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operations = void 0;
const sharp_1 = __importDefault(require("sharp"));
const debug_1 = __importDefault(require("debug"));
const versions_1 = require("./versions");
const debug = (0, debug_1.default)('iiif-processor:transform');
const DEFAULT_PAGE_THRESHOLD = 1;
const SCALE_PRECISION = 10000000;
class Operations {
    constructor(version, dims, opts) {
        const { sharp, pageThreshold, ...rest } = opts || {};
        const Implementation = versions_1.Versions[version];
        this.calculator = new Implementation.Calculator(dims[0], rest);
        this.pageThreshold = typeof pageThreshold === 'number' ? pageThreshold : DEFAULT_PAGE_THRESHOLD;
        this.pages = dims
            .map((dim, page) => ({ ...dim, page }))
            .sort((a, b) => b.width * b.height - a.width * a.height);
        this.sharpOptions = sharp;
    }
    region(v) {
        this.calculator.region(v);
        return this;
    }
    size(v) {
        this.calculator.size(v);
        return this;
    }
    rotation(v) {
        this.calculator.rotation(v);
        return this;
    }
    quality(v) {
        this.calculator.quality(v);
        return this;
    }
    format(v, density) {
        this.calculator.format(v, density);
        return this;
    }
    info() {
        return this.calculator.info();
    }
    canonicalPath() {
        return this.calculator.canonicalPath();
    }
    withMetadata(v) {
        this.keepMetadata = v;
        return this;
    }
    computePage() {
        const { fullSize } = this.info();
        const { page } = this.pages.find((_candidate, index) => {
            const next = this.pages[index + 1];
            debug('comparing candidate %j to target %j with a %d-pixel buffer', next, fullSize, this.pageThreshold);
            return !next || (next.width + this.pageThreshold < fullSize.width && next.height + this.pageThreshold < fullSize.height);
        });
        const resolution = this.pages[page];
        const scale = page === 0 ? 1 : Math.round((resolution.width / this.pages[0].width) * SCALE_PRECISION) / SCALE_PRECISION;
        debug('Using page %d (%j) as source and scaling by %f', page, resolution, scale);
        return { page, scale };
    }
    pipeline() {
        const pipeline = (0, sharp_1.default)({ limitInputPixels: false, ...(this.sharpOptions || {}) });
        const { page, scale } = this.computePage();
        pipeline.options.input.page = page;
        const { format, quality, region, rotation: { flop, degree }, size } = this.info();
        scaleRegion(region, scale, this.pages[page]);
        pipeline.extract(region).resize(size);
        if (flop)
            pipeline.flop();
        pipeline.rotate(degree);
        if (quality === 'gray')
            pipeline.grayscale();
        if (quality === 'bitonal')
            pipeline.threshold();
        setFormat(pipeline, format);
        if (this.keepMetadata)
            pipeline.keepMetadata();
        debug('Pipeline: %j', { page, region, size, rotation: { flop, degree }, quality, format });
        return pipeline;
    }
}
exports.Operations = Operations;
function setFormat(pipeline, format) {
    let pipelineFormat;
    const pipelineOptions = {};
    switch (format.type) {
        case 'jpeg':
            pipelineFormat = 'jpg';
            break;
        case 'tif':
            pipelineFormat = 'tiff';
            if (format.density) {
                pipelineOptions.xres = format.density / 25.4;
                pipelineOptions.yres = format.density / 25.4;
            }
            break;
        default:
            pipelineFormat = format.type;
    }
    pipeline.toFormat(pipelineFormat, pipelineOptions);
    if (format.density) {
        pipeline.withMetadata({ density: format.density });
    }
}
function scaleRegion(region, scale, page) {
    region.left = Math.floor(region.left * scale);
    region.top = Math.floor(region.top * scale);
    region.width = Math.floor(region.width * scale);
    region.height = Math.floor(region.height * scale);
    region.left = Math.max(region.left, 0);
    region.top = Math.max(region.top, 0);
    region.width = Math.min(region.width, page.width);
    region.height = Math.min(region.height, page.height);
    return region;
}
exports.default = { Operations };
