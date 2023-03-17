'use strict';

const assert = require('assert');
const Transform = require('../lib/transform');
const IIIFError = require('../lib/error');

const { qualities, formats, regions, sizes, rotations } = require('./fixtures/iiif-values');

let subject;

describe('environment options', () => {
  afterEach(() => {
    delete process.env.SHARP_OPTIONS;
  });

  it('uses the correct defaults', () => {
    subject = new Transform.Operations({ width: 1024, height: 768 });
    assert.equal(subject.pipeline.options.input.limitInputPixels, 0);
    assert.equal(subject.pipeline.options.input.sequentialRead, false);
    assert.equal(subject.pipeline.options.input.unlimited, false);
  });

  it("correctly reads SHARP_OPTIONS", () => {
    process.env.SHARP_OPTIONS = '{"sequentialRead":true}';
    subject = new Transform.Operations({ width: 1024, height: 768 });
    assert.equal(subject.pipeline.options.input.limitInputPixels, 0);
    assert.equal(subject.pipeline.options.input.sequentialRead, true);
    assert.equal(subject.pipeline.options.input.unlimited, false);
  });

  it("ignores bad JSON", () => {
    process.env.SHARP_OPTIONS = '{ this is not json';
    subject = new Transform.Operations({ width: 1024, height: 768 });
    assert.equal(subject.pipeline.options.input.limitInputPixels, 0);
    assert.equal(subject.pipeline.options.input.sequentialRead, false);
    assert.equal(subject.pipeline.options.input.unlimited, false);
  });
});

describe('transformer', () => {
  beforeEach(() => {
    subject = new Transform.Operations({ width: 1024, height: 768 });
  });

  it('quality', () => {
    qualities.forEach((value) => assert.doesNotThrow(() => subject.quality(value), IIIFError));
    assert.throws(() => subject.quality('badValue'), IIIFError);
  });

  it('format', () => {
    formats.forEach((value) => assert.doesNotThrow(() => subject.format(value), IIIFError));
    assert.doesNotThrow(() => subject.format('png', 600), IIIFError);
    assert.throws(() => subject.format('png', 'badValue'), IIIFError);
    assert.throws(() => subject.format('badValue'), IIIFError);
  });

  it('region', () => {
    regions.forEach((value) => assert.doesNotThrow(() => subject.region(value), IIIFError));
    assert.throws(() => subject.region('badValue'), IIIFError);
    assert.throws(() => subject.region('10,10,0,0'), IIIFError);
    assert.throws(() => subject.region('10,10,10,0'), IIIFError);
    assert.throws(() => subject.region('10,10,0,10'), IIIFError);
    assert.throws(() => subject.region('pct:10,10,0,0'), IIIFError);

    subject = new Transform.Operations({ width: 768, height: 1024 });
    assert.doesNotThrow(() => subject.region('square'), IIIFError);
  });

  it('size', () => {
    sizes.forEach((value) => assert.doesNotThrow(() => subject.size(value), IIIFError));
    assert.throws(() => subject.size('badValue'), IIIFError);
    assert.throws(() => subject.size('10,0'), IIIFError);
    assert.throws(() => subject.size('0,10'), IIIFError);
    assert.throws(() => subject.size('0,0'), IIIFError);
    assert.throws(() => subject.size('-10,10'), IIIFError);
    assert.throws(() => subject.size('-10,-10'), IIIFError);
    assert.throws(() => subject.size('pct:0'), IIIFError);
    assert.throws(() => subject.size('pct:-50'), IIIFError);
  });

  it('rotation', () => {
    rotations.forEach((value) => assert.doesNotThrow(() => subject.rotation(value), IIIFError));
    assert.throws(() => subject.rotation('badValue'), IIIFError);
  });
});
