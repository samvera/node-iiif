'use strict';

const assert = require('assert');
const iiif = require('../index');

let subject;
const base = 'https://example.org/iiif/2/ab/cd/ef/gh/i';
const dims = { width: 1024, height: 768 };

describe('IIIF Processor', () => {
  beforeEach(() => {
    subject = new iiif.Processor(`${base}/10,20,30,40/pct:50/45/default.png`, (id) => id);
  });

  it('Parse URL', () => {
    assert.strictEqual(subject.rotation, '45');
    assert.strictEqual(subject.size, 'pct:50');
    assert.strictEqual(subject.region, '10,20,30,40');
    assert.strictEqual(subject.quality, 'default');
    assert.strictEqual(subject.format, 'png');
  });

  it('Create pipeline', () => {
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.width, 15);
    assert.strictEqual(opts.height, -1);
    assert.strictEqual(opts.leftOffsetPre, 10);
    assert.strictEqual(opts.topOffsetPre, 20);
    assert.strictEqual(opts.widthPre, 30);
    assert.strictEqual(opts.heightPre, 40);
    assert.strictEqual(opts.formatOut, 'png');
    assert.strictEqual(opts.canvas, 'crop');
    assert.strictEqual(opts.withMetadata, false);
  });
});

describe('Include metadata', () => {
  beforeEach(() => {
    subject = new iiif.Processor(
      `${base}/10,20,30,40/pct:50/45/default.jpg`,
      (id) => id,
      { includeMetadata: true }
    );
  });

  it('Includes preexisting metadata', () => {
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadata, true);
  });
});

describe('TIFF Download', () => {
  beforeEach(() => {
    subject = new iiif.Processor(`${base}/10,20,30,40/pct:50/45/default.tif`, (id) => id);
  });

  it('Output TIFF format', () => {
    const pipe = subject.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.width, 15);
    assert.strictEqual(opts.height, -1);
    assert.strictEqual(opts.leftOffsetPre, 10);
    assert.strictEqual(opts.topOffsetPre, 20);
    assert.strictEqual(opts.widthPre, 30);
    assert.strictEqual(opts.heightPre, 40);
    assert.strictEqual(opts.formatOut, 'tiff');
    assert.strictEqual(opts.canvas, 'crop');
  });
});

describe('Density', () => {
  beforeEach(() => {
    subject = (ext) => {
      return new iiif.Processor(
        `https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.${ext}`,
        (id) => id,
        { density: 600 }
      );
    };
  });

  it('Adds density to TIFF', () => {
    const processor = subject('tif');
    const pipe = processor.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.tiffXres, 600 / 25.4);
    assert.strictEqual(opts.tiffYres, 600 / 25.4);
  });

  it('Adds density to JPEG', () => {
    const processor = subject('jpg');
    const pipe = processor.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadataDensity, 600);
  });

  it('Adds density to PNG', () => {
    const processor = subject('png');
    const pipe = processor.pipeline(dims);
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadataDensity, 600);
  });
});

describe('constructor', () => {
  it('must parse the object-based constructor', () => {
    subject = new iiif.Processor(
      `${base}/10,20,30,40/pct:50/45/default.tif`,
      () => 'streamResolver', 
      { dimensionFunction: () => 'dimensionFunction', maxWidth: 'maxWidth', includeMetadata: true, density: 600 }
    );

    assert.strictEqual(subject.streamResolver(), 'streamResolver');
    assert.strictEqual(subject.dimensionFunction(), 'dimensionFunction');
    assert.strictEqual(subject.maxWidth, 'maxWidth');
    assert.strictEqual(subject.includeMetadata, true);
    assert.strictEqual(subject.density, 600);
  });

  it('must parse the multi-argument constructor', () => {
    const spy = jest.spyOn(global.console, 'warn').mockImplementation();
    subject = new iiif.Processor(
      `${base}/10,20,30,40/pct:50/45/default.tif`,
      () => 'streamResolver',
      () => 'dimensionFunction',
      'maxWidth',
      true
    );
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/deprecated/));
    spy.mockRestore();

    assert.strictEqual(subject.streamResolver(), 'streamResolver');
    assert.strictEqual(subject.dimensionFunction(), 'dimensionFunction');
    assert.strictEqual(subject.maxWidth, 'maxWidth');
    assert.strictEqual(subject.includeMetadata, true);
    assert.strictEqual(subject.density, null);
  });
});

describe('constructor errors', () => {
  it('requires a streamResolver', () => {
    assert.throws(() => {
      return new iiif.Processor(`${base}/10,20,30,40/pct:50/45/default.tif`, {});
    }, iiif.IIIFError);
  });

  it('requires a valid URL', () => {
    assert.throws(() => {
      return new iiif.Processor(`${base}/10,20,30,40/pct:50/45/default.blargh`, (id) => id);
    }, iiif.IIIFError);
  });
});
