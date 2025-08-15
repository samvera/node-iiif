var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/error.ts
var IIIFError = class extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.statusCode = opts.statusCode;
  }
};

// src/processor.ts
import Debug3 from "debug";
import mime from "mime-types";
import path from "path";
import sharp from "sharp";

// src/transform.ts
import Sharp from "sharp";
import Debug2 from "debug";

// src/v2/index.ts
var v2_exports = {};
__export(v2_exports, {
  Base: () => Base,
  Calculator: () => Calculator,
  Formats: () => Formats,
  Qualities: () => Qualities,
  infoDoc: () => infoDoc,
  profileLink: () => profileLink
});

// src/calculator/base.ts
import Debug from "debug";
var debug = Debug("iiif-processor:calculator");
var IR = "\\d+";
var FR = "\\d+(?:\\.\\d+)?";
var PCTR = /^pct:(?<val>[\d.,]+)/;
var Validators = {
  quality: ["color", "gray", "bitonal", "default"],
  format: ["jpg", "jpeg", "tif", "tiff", "png", "webp"],
  region: ["full", "square", `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ["full", "max", `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: [`\\!?${FR}`]
};
function validateDensity(v) {
  debug("validating density %s", v);
  if (v === null) return true;
  if (v === void 0) return true;
  if (typeof v !== "number" || v < 0) {
    throw new IIIFError(`Invalid density value: ${v}`);
  }
  return true;
}
var Base = class {
  static _matchers() {
    return Validators;
  }
  static _validator(type) {
    const result = this._matchers()[type].join("|");
    return `(?<${type}>${result})`;
  }
  static parsePath(path2) {
    const transformation = ["region", "size", "rotation"].map((type) => this._validator(type)).join("/") + "/" + this._validator("quality") + "." + this._validator("format");
    const re = new RegExp(`^/?(?<id>.+?)/(?:(?<info>info.json)|${transformation})$`);
    const result = re.exec(path2)?.groups;
    if (!result) throw new IIIFError(`Not a valid IIIF path: ${path2}`, { statusCode: 400 });
    return result;
  }
  constructor(dims, opts = {}) {
    this.dims = { ...dims };
    this.opts = { ...opts };
    this._sourceDims = { ...dims };
    this._canonicalInfo = {
      region: "full",
      size: "full",
      rotation: "0",
      quality: "default",
      format: "jpg"
    };
    this._parsedInfo = {
      region: { left: 0, top: 0, ...dims },
      size: { width: dims.width, height: dims.height, fit: "fill" },
      rotation: { flop: false, degree: 0 },
      quality: "default",
      format: { type: "jpg" },
      upscale: true
    };
  }
  _validate(type, v) {
    if (type === "density") return validateDensity(v);
    const re = new RegExp(`^${this.constructor._validator(type)}$`);
    debug("validating %s %s against %s", type, v, re);
    if (!re.test(String(v))) {
      throw new IIIFError(`Invalid ${type}: ${v}`, { statusCode: 400 });
    }
    return true;
  }
  region(v) {
    this._validate("region", v);
    const pct = PCTR.exec(v);
    let isFull = false;
    if (v === "full") {
      this._parsedInfo.region = { left: 0, top: 0, ...this.dims };
      isFull = true;
    } else if (v === "square") {
      this._parsedInfo.region = regionSquare(this.dims);
    } else if (pct) {
      this._parsedInfo.region = regionPct(pct.groups?.val, this.dims);
    } else {
      this._parsedInfo.region = regionXYWH(v);
    }
    this._canonicalInfo.region = isFull ? "full" : this._parsedInfo.region;
    this._constrainRegion();
    return this;
  }
  size(v) {
    this._validate("size", v);
    const pct = PCTR.exec(v);
    let isMax = false;
    if (["full", "max"].includes(v)) {
      this._setSize(this._parsedInfo.region);
      isMax = true;
    } else if (pct) {
      this._setSize(sizePct(pct.groups?.val, this._parsedInfo.region));
    } else {
      this._setSize(sizeWH(v));
    }
    this._canonicalInfo.size = isMax ? v : this._canonicalSize();
    return this;
  }
  rotation(v) {
    this._validate("rotation", v);
    this._canonicalInfo.rotation = v;
    this._parsedInfo.rotation = { flop: v[0] === "!", degree: Number(v.replace(/^!/, "")) };
    return this;
  }
  quality(v) {
    this._validate("quality", v);
    this._canonicalInfo.quality = v;
    this._parsedInfo.quality = v;
    return this;
  }
  format(v, density) {
    this._validate("format", v);
    this._validate("density", density);
    this._canonicalInfo.format = v;
    this._parsedInfo.format = { type: v, density };
    return this;
  }
  info() {
    return { ...this._parsedInfo, fullSize: fullSize(this._sourceDims, this._parsedInfo) };
  }
  canonicalPath() {
    const { region, size, rotation, quality, format } = this._canonicalInfo;
    return `${region}/${size}/${rotation}/${quality}.${format}`;
  }
  _setSize(v) {
    const max = { ...this.opts?.max || {} };
    max.height = max.height || max.width;
    this._parsedInfo.size = v.left !== void 0 ? { width: v.width, height: v.height, fit: "fill" } : { ...v };
    this._constrainSize(max);
    if (!this._parsedInfo.upscale) {
      this._constrainSize(this._sourceDims);
    }
    return this;
  }
  _constrainSize(constraints) {
    const full = fullSize(this._sourceDims, this._parsedInfo);
    const constraint = minNum(
      constraints.width / full.width,
      constraints.height / full.height,
      constraints.area / (full.width * full.height)
    );
    if (constraint < 1) {
      if (this._parsedInfo.size.width) {
        this._parsedInfo.size.width = Math.floor(this._parsedInfo.size.width * constraint);
      }
      if (this._parsedInfo.size.height) {
        this._parsedInfo.size.height = Math.floor(this._parsedInfo.size.height * constraint);
      }
    }
  }
  _canonicalSize() {
    const { width, height } = this._parsedInfo.size;
    const result = (width?.toString() || "") + "," + (height?.toString() || "");
    return this._parsedInfo.size.fit === "inside" ? `!${result}` : result;
  }
  _constrainRegion() {
    let { left, top, width, height } = this._parsedInfo.region;
    left = Math.max(left, 0);
    top = Math.max(top, 0);
    if (left > this.dims.width || top > this.dims.height) {
      throw new IIIFError("Region is out of bounds", { statusCode: 400 });
    }
    width = Math.min(width, this.dims.width - left);
    height = Math.min(height, this.dims.height - top);
    this._parsedInfo.region = { left, top, width, height };
  }
};
function minNum(...args) {
  const nums = args.filter((arg) => typeof arg === "number" && !isNaN(arg));
  return Math.min(...nums);
}
function fullSize(dims, { region, size }) {
  const regionAspect = region.width / region.height;
  if (!size.width && !size.height) {
    throw new IIIFError("Must specify at least one of width or height", { statusCode: 400 });
  }
  if (!size.height && size.width != null) size.height = Math.floor(size.width / regionAspect);
  if (!size.width && size.height != null) size.width = Math.floor(size.height * regionAspect);
  const scaleFactor = size.width / region.width;
  const result = { width: Math.floor(dims.width * scaleFactor), height: Math.floor(dims.height * scaleFactor) };
  debug("Region %j at size %j yields full size %j, a scale factor of %f", region, size, result, scaleFactor);
  return result;
}
function regionSquare(dims) {
  let result = { left: 0, top: 0, width: dims.width, height: dims.height };
  if (dims.width !== dims.height) {
    const side = Math.min(dims.width, dims.height);
    result = { ...result, width: side, height: side };
    const offset = Math.abs(Math.floor((dims.width - dims.height) / 2));
    if (dims.width > dims.height) {
      result.left = offset;
      result.top = 0;
    } else {
      result.left = 0;
      result.top = offset;
    }
  }
  return result;
}
function regionPct(v, dims) {
  let x, y, w, h;
  [x, y, w, h] = v.split(/\s*,\s*/).map((pct) => Number(pct) / 100);
  [x, w] = [x, w].map((val) => Math.floor(dims.width * val));
  [y, h] = [y, h].map((val) => Math.floor(dims.height * val));
  return regionXYWH([x, y, w, h]);
}
function regionXYWH(v) {
  const parts = typeof v === "string" ? v.split(/\s*,\s*/).map((val) => Number(val)) : v;
  const result = { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError("Region width and height must both be > 0", { statusCode: 400 });
  }
  return result;
}
function sizePct(v, dims) {
  const pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw new IIIFError(`Invalid resize %: ${v}`, { statusCode: 400 });
  }
  const width = Math.floor(dims.width * (pct / 100));
  return sizeWH(`${width},`);
}
function sizeWH(v) {
  const result = { fit: "fill" };
  let parts;
  if (typeof v === "string") {
    if (v[0] === "!") {
      result.fit = "inside";
      v = v.slice(1);
    }
    parts = v.split(/\s*,\s*/).map((val) => val === "" ? null : Number(val));
  } else {
    parts = v;
  }
  [result.width, result.height] = parts;
  if (result.width === 0 || result.height === 0) {
    throw new IIIFError("Resize width and height must both be > 0", { statusCode: 400 });
  }
  return result;
}
var Qualities = Validators.quality;
var Formats = Validators.format;

// src/calculator/v2.ts
var Calculator = class extends Base {
};

// src/v2/info.ts
var profileLink = "http://iiif.io/api/image/2/level2.json";
var IIIFProfile = {
  formats: new Set(Formats),
  qualities: new Set(Qualities),
  supports: /* @__PURE__ */ new Set([
    "baseUriRedirect",
    "canonicalLinkHeader",
    "cors",
    "jsonldMediaType",
    "mirroring",
    "profileLinkHeader",
    "regionByPct",
    "regionByPx",
    "regionSquare",
    "rotationArbitrary",
    "rotationBy90s",
    "sizeAboveFull",
    "sizeByConfinedWh",
    "sizeByDistortedWh",
    "sizeByForcedWh",
    "sizeByH",
    "sizeByPct",
    "sizeByW",
    "sizeByWh",
    "sizeByWhListed"
  ])
};
function infoDoc({ id, width, height, sizes, max }) {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };
  return {
    "@context": "http://iiif.io/api/image/2/context.json",
    "@id": id,
    protocol: "http://iiif.io/api/image",
    width,
    height,
    sizes,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }
    ],
    profile: [profileLink, { ...IIIFProfile, ...maxAttrs }]
  };
}

// src/v3/index.ts
var v3_exports = {};
__export(v3_exports, {
  Base: () => Base,
  Calculator: () => Calculator2,
  Formats: () => Formats,
  Qualities: () => Qualities,
  infoDoc: () => infoDoc2,
  profileLink: () => profileLink2
});

// src/calculator/v3.ts
var Calculator2 = class extends Base {
  static _matchers() {
    const result = { ...super._matchers() };
    result.size = [...result.size].reduce((sizes, pattern) => {
      if (pattern !== "full") sizes.push(`\\^?${pattern}`);
      return sizes;
    }, []);
    return result;
  }
  constructor(dims, opts = {}) {
    super(dims, opts);
    this._canonicalInfo.size = "max";
    this._parsedInfo.upscale = false;
  }
  size(v) {
    if (v[0] === "^") {
      this._parsedInfo.upscale = true;
      v = v.slice(1, v.length);
    }
    return super.size(v);
  }
};

// src/v3/info.ts
var profileLink2 = "https://iiif.io/api/image/3/level2.json";
var ComplianceProfile = {
  level: "level2",
  uri: profileLink2,
  qualities: /* @__PURE__ */ new Set(["default"]),
  formats: /* @__PURE__ */ new Set(["jpg", "png"])
};
var IIIFExtras = {
  extraFormats: new Set(Formats.filter((format) => !ComplianceProfile.formats.has(format))),
  extraQualities: new Set(Qualities.filter((quality) => !ComplianceProfile.qualities.has(quality))),
  extraFeatures: [
    "canonicalLinkHeader",
    "mirroring",
    "profileLinkHeader",
    "rotationArbitrary",
    "sizeByDistortedWh",
    "sizeByForcedWh",
    "sizeByWhListed",
    "sizeUpscaling"
  ]
};
function infoDoc2({ id, width, height, sizes, max }) {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };
  return {
    "@context": "http://iiif.io/api/image/3/context.json",
    id,
    type: "ImageService3",
    protocol: "http://iiif.io/api/image",
    width,
    height,
    sizes,
    extraFormats: [...IIIFExtras.extraFormats],
    extraQualities: [...IIIFExtras.extraQualities],
    extraFeatures: IIIFExtras.extraFeatures,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }
    ],
    profile: ComplianceProfile,
    ...maxAttrs
  };
}

// src/versions.ts
var Versions = {
  2: v2_exports,
  3: v3_exports
};
var versions_default = Versions;

// src/transform.ts
var debug2 = Debug2("iiif-processor:transform");
var DEFAULT_PAGE_THRESHOLD = 1;
var SCALE_PRECISION = 1e7;
var Operations = class {
  constructor(version, dims, opts) {
    const { sharp: sharp2, pageThreshold, ...rest } = opts || {};
    const Implementation = Versions[version];
    this.calculator = new Implementation.Calculator(dims[0], rest);
    this.pageThreshold = typeof pageThreshold === "number" ? pageThreshold : DEFAULT_PAGE_THRESHOLD;
    this.pages = dims.map((dim, page) => ({ ...dim, page })).sort((a, b) => b.width * b.height - a.width * a.height);
    this.sharpOptions = sharp2;
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
    const { fullSize: fullSize2 } = this.info();
    const { page } = this.pages.find((_candidate, index) => {
      const next = this.pages[index + 1];
      debug2("comparing candidate %j to target %j with a %d-pixel buffer", next, fullSize2, this.pageThreshold);
      return !next || next.width + this.pageThreshold < fullSize2.width && next.height + this.pageThreshold < fullSize2.height;
    });
    const resolution = this.pages[page];
    const scale = page === 0 ? 1 : Math.round(resolution.width / this.pages[0].width * SCALE_PRECISION) / SCALE_PRECISION;
    debug2("Using page %d (%j) as source and scaling by %f", page, resolution, scale);
    return { page, scale };
  }
  pipeline() {
    const pipeline = Sharp({ limitInputPixels: false, ...this.sharpOptions || {} });
    const { page, scale } = this.computePage();
    pipeline.options.input.page = page;
    const { format, quality, region, rotation: { flop, degree }, size } = this.info();
    scaleRegion(region, scale, this.pages[page]);
    pipeline.extract(region).resize(size);
    if (flop) pipeline.flop();
    pipeline.rotate(degree);
    if (quality === "gray") pipeline.grayscale();
    if (quality === "bitonal") pipeline.threshold();
    setFormat(pipeline, format);
    if (this.keepMetadata) pipeline.keepMetadata();
    debug2("Pipeline: %j", { page, region, size, rotation: { flop, degree }, quality, format });
    return pipeline;
  }
};
function setFormat(pipeline, format) {
  let pipelineFormat;
  const pipelineOptions = {};
  switch (format.type) {
    case "jpeg":
      pipelineFormat = "jpg";
      break;
    case "tif":
      pipelineFormat = "tiff";
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

// src/processor.ts
var debug3 = Debug3("iiif-processor:main");
var debugv = Debug3("verbose:iiif-processor");
var defaultpathPrefix = "/iiif/{{version}}/";
function getIiifVersion(url, template) {
  const { origin, pathname } = new URL(url);
  const templateMatcher = template.replace(/\{\{version\}\}/, "(?<iiifVersion>2|3)");
  const pathMatcher = `^(?<prefix>${templateMatcher})(?<request>.+)$`;
  const re = new RegExp(pathMatcher);
  const parsed = re.exec(pathname);
  if (parsed) {
    parsed.groups.prefix = origin + parsed.groups.prefix;
    return { ...parsed.groups };
  } else {
    throw new IIIFError("Invalid IIIF path");
  }
}
var Processor = class {
  constructor(url, streamResolver, opts = {}) {
    this.errorClass = IIIFError;
    this.includeMetadata = false;
    this.debugBorder = false;
    const { prefix, iiifVersion, request } = getIiifVersion(url, opts.pathPrefix || defaultpathPrefix);
    if (typeof streamResolver !== "function") {
      throw new IIIFError("streamResolver option must be specified");
    }
    if (opts.max?.height && !opts.max?.width) {
      throw new IIIFError("maxHeight cannot be specified without maxWidth");
    }
    const defaults = {
      dimensionFunction: this.defaultDimensionFunction.bind(this),
      density: null
    };
    this.setOpts({ ...defaults, iiifVersion, ...opts, prefix, request }).initialize(streamResolver);
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
    this.Implementation = versions_default[this.version];
    if (!this.Implementation) {
      throw new IIIFError(`No implementation found for IIIF Image API v${this.version}`);
    }
    const params = this.Implementation.Calculator.parsePath(this.request);
    debug3("Parsed URL: %j", params);
    Object.assign(this, params);
    this.streamResolver = streamResolver;
    if (this.quality && this.format) {
      this.filename = [this.quality, this.format].join(".");
    } else if (this.info) {
      this.filename = "info.json";
    }
    return this;
  }
  async withStream({ id, baseUrl }, callback) {
    debug3("Requesting stream for %s", id);
    if (this.streamResolver.length === 2) {
      return await this.streamResolver({ id, baseUrl }, callback);
    } else {
      const stream = await this.streamResolver({ id, baseUrl });
      return await callback(stream);
    }
  }
  async defaultDimensionFunction({ id, baseUrl }) {
    const result = [];
    let page = 0;
    const target = sharp({ limitInputPixels: false, page });
    return await this.withStream({ id, baseUrl }, async (stream) => {
      stream.pipe(target);
      const { width, height, pages } = await target.metadata();
      if (!width || !height || !pages) return result;
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
      debug3("Attempting to use dimensionFunction to retrieve dimensions for %j", this.id);
      const params = { id: this.id, baseUrl: this.baseUrl };
      let dims = await this.dimensionFunction(params);
      if (fallback && !dims) {
        const warning = "Unable to get dimensions for %s using custom function. Falling back to sharp.metadata().";
        debug3(warning, this.id);
        console.warn(warning, this.id);
        dims = await this.defaultDimensionFunction(params);
      }
      if (!Array.isArray(dims)) dims = [dims];
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
    uri.pathname = path.join(uri.pathname, this.id);
    const id = uri.toString();
    const doc = this.Implementation.infoDoc({ id, ...dim, sizes, max: this.max });
    for (const prop in doc) {
      if (doc[prop] === null || doc[prop] === void 0) delete doc[prop];
    }
    const body = JSON.stringify(doc, (_key, value) => value?.constructor === Set ? [...value] : value);
    return { contentType: "application/json", body };
  }
  operations(dim) {
    const sharpOpt = this.sharpOptions;
    const { max, pageThreshold } = this;
    debug3("pageThreshold: %d", pageThreshold);
    return new Operations(this.version, dim, { sharp: sharpOpt, max, pageThreshold }).region(this.region).size(this.size).rotation(this.rotation).quality(this.quality).format(this.format, this.density ?? void 0).withMetadata(this.includeMetadata);
  }
  async applyBorder(transformed) {
    const buf = await transformed.toBuffer();
    const borderPipe = sharp(buf, { limitInputPixels: false });
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
    debugv("Request %s", this.request);
    const dim = await this.dimensions();
    const operations = this.operations(dim);
    debugv("Operations: %j", operations);
    const pipeline = await operations.pipeline();
    const result = await this.withStream({ id: this.id, baseUrl: this.baseUrl }, async (stream) => {
      debug3("piping stream to pipeline");
      let transformed = await stream.pipe(pipeline);
      if (this.debugBorder) {
        transformed = await this.applyBorder(transformed);
      }
      debug3("converting to buffer");
      return await transformed.toBuffer();
    });
    debug3("returning %d bytes", result.length);
    debug3("baseUrl", this.baseUrl);
    const canonicalUrl = new URL(path.join(this.id, operations.canonicalPath()), this.baseUrl);
    return {
      canonicalLink: canonicalUrl.toString(),
      profileLink: this.Implementation.profileLink,
      contentType: mime.lookup(this.format),
      body: result
    };
  }
  async execute() {
    if (this.filename === "info.json") {
      return await this.infoJson();
    } else {
      return await this.iiifImage();
    }
  }
};
export {
  IIIFError,
  Processor,
  Versions
};
//# sourceMappingURL=index.mjs.map