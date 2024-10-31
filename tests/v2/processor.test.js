'use strict';

const assert = require('assert');
const { Stream } = require('stream');
const IIIFError = require('../../src/error');
const Processor = require('../../src/processor');

let subject;
const base = 'https://example.org/iiif/2/ab/cd/ef/gh/i';
const dims = [{ width: 1024, height: 768 }];
const identityResolver = ({ id }) => id;

describe('IIIF Processor', () => {
  beforeEach(() => {
    subject = new Processor(`${base}/10,20,30,40/pct:50/45/default.png`, identityResolver);
  });

  it('Parse URL', () => {
    assert.strictEqual(subject.id, 'ab/cd/ef/gh/i');
    assert.strictEqual(subject.baseUrl, 'https://example.org/iiif/2/');
    assert.strictEqual(subject.rotation, '45');
    assert.strictEqual(subject.size, 'pct:50');
    assert.strictEqual(subject.region, '10,20,30,40');
    assert.strictEqual(subject.quality, 'default');
    assert.strictEqual(subject.format, 'png');
  });

  it('Create pipeline', async () => {
    const pipe = await subject.operations(dims).pipeline();
    const opts = pipe.options;

    assert.strictEqual(opts.width, 15);
    assert.strictEqual(opts.height, -1);
    assert.strictEqual(opts.leftOffsetPre, 10);
    assert.strictEqual(opts.topOffsetPre, 20);
    assert.strictEqual(opts.widthPre, 30);
    assert.strictEqual(opts.heightPre, 40);
    assert.strictEqual(opts.formatOut, 'png');
    assert.strictEqual(opts.canvas, 'crop');
    assert.strictEqual(opts.keepMetadata, 0);
  });
});

describe('Minimum width and height', () => {
  beforeEach(() => {
    subject = new Processor(`${base}/8192,0,7,5466/1,342/0/default.jpg`, identityResolver);
  });

  it('Avoids having a width or height < 1', async () => {
    const dims = [
      { width: 8199, height: 5466 },
      { width: 4099, height: 2733 },
      { width: 2049, height: 1366 },
      { width: 1024, height: 683 },
      { width: 512, height: 341 },
      { width: 256, height: 170 }
    ];
    const pipe = await subject.operations(dims).pipeline();
    const opts = pipe.options;
    assert.notEqual(opts.widthPre, 0);
    assert.notEqual(opts.heightPre, 0);
  });
});

describe('Include metadata', () => {
  beforeEach(() => {
    subject = new Processor( 
      `${base}/10,20,30,40/pct:50/45/default.jpg`,
      ({ id }) => id,
      { includeMetadata: true }
    );
  });

  it('Includes preexisting metadata', async () => {
    const pipe = await subject.operations(dims).pipeline();
    const opts = pipe.options;

    assert.notEqual(opts.keepMetadata, 0);
  });
});

describe('TIFF Download', () => {
  beforeEach(() => {
    subject = new Processor(`${base}/10,20,30,40/pct:50/45/default.tif`, identityResolver);
  });

  it('Output TIFF format', async () => {
    const pipe = await subject.operations(dims).pipeline();
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
      return new Processor( 
        `https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.${ext}`,
        ({ id }) => id,
        { density: 600 }
      );
    };
  });

  it('Adds density to TIFF', async () => {
    const processor = subject('tif');
    const pipe = await processor.operations(dims).pipeline();
    const opts = pipe.options;

    assert.strictEqual(opts.tiffXres, 600 / 25.4);
    assert.strictEqual(opts.tiffYres, 600 / 25.4);
  });

  it('Adds density to JPEG', async () => {
    const processor = subject('jpg');
    const pipe = await processor.operations(dims).pipeline();
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadataDensity, 600);
  });

  it('Adds density to PNG', async () => {
    const processor = subject('png');
    const pipe = await processor.operations(dims).pipeline();
    const opts = pipe.options;

    assert.strictEqual(opts.withMetadataDensity, 600);
  });
});

describe('constructor', () => {
  it('must parse the object-based constructor', () => {
    subject = new Processor( 
      `${base}/10,20,30,40/pct:50/45/default.tif`,
      () => 'streamResolver',
      { dimensionFunction: () => 'dimensionFunction', max: { width: 'maxWidth' }, includeMetadata: true, density: 600 }
    );

    assert.strictEqual(subject.streamResolver(), 'streamResolver');
    assert.strictEqual(subject.dimensionFunction(), 'dimensionFunction');
    assert.strictEqual(subject.max.width, 'maxWidth');
    assert.strictEqual(subject.includeMetadata, true);
    assert.strictEqual(subject.density, 600);
  });

  it('properly handles custom sharp options', async () => {
    let pipe;
    
    subject = new Processor(
      `${base}/10,20,30,40/pct:50/45/default.tif`,
      () => 'streamResolver',
      { sharpOptions: { sequentialRead: false } }
    );
    pipe = await subject.operations(dims).pipeline();
    assert.strictEqual(pipe.options.input.sequentialRead, false);
    
    subject = new Processor( 
      `${base}/10,20,30,40/pct:50/45/default.tif`,
      () => 'streamResolver',
      { sharpOptions: { sequentialRead: true } }
    );
    pipe = await subject.operations(dims).pipeline();
    assert.strictEqual(pipe.options.input.sequentialRead, true);
  });

  it('takes a custom version and path prefix', () => {
    subject = new Processor(
        'https://example.org/iiif/III/ab/cd/ef/gh/i/info.json',
        ({ id }) => id,
        { iiifVersion: 3, pathPrefix: '/iiif/III/' }
      );
    assert.strictEqual(subject.version, 3);
    assert.strictEqual(subject.pathPrefix, '/iiif/III/');
  });
});

describe('constructor errors', () => {
  it('requires a streamResolver', () => {
    assert.throws(() => {
      return new Processor(`${base}/10,20,30,40/pct:50/45/default.tif`, {});
    }, IIIFError);
  });

  it('requires a valid URL', () => {
    assert.throws(() => {
      return new Processor(`${base}/10,20,30,40/pct:50/45/default.blargh`, identityResolver);
    }, IIIFError);
  });

  it('needs to be able to infer the version', () => {
    assert.throws(() => {
      return new Processor('https://example.org/iiif/X/ab/cd/ef/gh/i/info.json', identityResolver);
    }, IIIFError);
  });

  it('requires a valid IIIF version', () => {
    assert.throws(() => {
      return new Processor('https://example.org/iiif/0/ab/cd/ef/gh/i/info.json', identityResolver);
    }, IIIFError);
  });
});

describe('stream processor', () => {
  it('passes the id and baseUrl to the function', () => {
    expect.assertions(2) // ensures our streamResolver assertions are both executed in this test

    const streamResolver = ({ id, baseUrl }) => {
      expect(id).toEqual('i');
      expect(baseUrl).toEqual('https://example.org/iiif/2/ab/cd/ef/gh/');

      return new Stream.Readable({
        read() {}
      });
    }

    const subject = new Processor(`https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.png`, streamResolver, {pathPrefix: 'iiif/2/ab/cd/ef/gh'});
    subject.execute();
  })
})

describe('dimension function', () => {
  it('passes the id and baseUrl to the function', () => {
    expect.assertions(2) // ensures our dimension function assertions are both executed in this test

    const streamResolver = ({ id, baseUrl }) => {
      return new Stream.Readable({
        read() {}
      });
    }

    const dimensionFunction = ({ id, baseUrl }) => {
      expect(id).toEqual('i');
      expect(baseUrl).toEqual('https://example.org/iiif/2/ab/cd/ef/gh/');
      return { width: 100, height: 100 }
    }

    const subject = new Processor( 
      `https://example.org/iiif/2/ab/cd/ef/gh/i/10,20,30,40/pct:50/45/default.png`,
      streamResolver,
      { dimensionFunction, pathPrefix: 'iiif/2/ab/cd/ef/gh' }
    );
    subject.execute();
  })
})
