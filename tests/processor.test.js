"use strict";

const assert = require("assert");
const iiif = require("../index");

let subject;

describe("IIIF Processor", () => {
  beforeEach(() => {
    subject = new iiif.Processor(
      "https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.png",
      (id) => id
    );
  });

  it("Parse URL", () => {
    assert.strictEqual(subject.rotation, "45");
    assert.strictEqual(subject.size, "pct:50");
    assert.strictEqual(subject.region, "10,20,30,40");
    assert.strictEqual(subject.quality, "default");
    assert.strictEqual(subject.format, "png");
  });

  it("Create pipeline", () => {
    const dims = { width: 1024, height: 768 };
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.width, 15);
    assert.strictEqual(opts.height, -1);
    assert.strictEqual(opts.leftOffsetPre, 10);
    assert.strictEqual(opts.topOffsetPre, 20);
    assert.strictEqual(opts.widthPre, 30);
    assert.strictEqual(opts.heightPre, 40);
    assert.strictEqual(opts.formatOut, "png");
    assert.strictEqual(opts.canvas, "crop");
    assert.strictEqual(opts.withMetadata, false);
  });
});

describe("Include metadata", () => {
  beforeEach(() => {
    subject = new iiif.Processor(
      "https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.jpg",
      (id) => id,
      null,
      null,
      true
    );
  });

  it("Includes preexisting metadata", () => {
    const dims = { width: 1024, height: 768 };
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadata, true);
  });
});

describe("TIFF Download", () => {
  beforeEach(() => {
    subject = new iiif.Processor(
      "https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.tif",
      (id) => id
    );
  });

  it("Create pipeline", () => {
    const dims = { width: 1024, height: 768 };
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.width, 15);
    assert.strictEqual(opts.height, -1);
    assert.strictEqual(opts.leftOffsetPre, 10);
    assert.strictEqual(opts.topOffsetPre, 20);
    assert.strictEqual(opts.widthPre, 30);
    assert.strictEqual(opts.heightPre, 40);
    assert.strictEqual(opts.formatOut, "tiff");
    assert.strictEqual(opts.canvas, "crop");
  });
});
