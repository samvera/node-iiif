'use strict';

const assert = require('assert');
const fs = require('fs');
const iiif = require('../index');
const probe = require('probe-image-size');
const { qualities, formats, regions, sizes, rotations } = require('./fixtures/iiif-values');

const base = 'https://example.org/iiif/2/ab/cd/ef/gh/i';
const streamResolver = () => fs.createReadStream('./tests/fixtures/samvera.tif');
let subject;
let consoleWarnMock;

describe('info.json', () => {
  it('produces a valid info.json', async () => {
    subject = new iiif.Processor(`${base}/info.json`, streamResolver, { pathPrefix: 'iiif/2/ab/cd/ef/gh' });
    const result = await subject.execute();
    const info = JSON.parse(result.body);
    assert.strictEqual(info.profile[1].maxWidth, undefined);
    assert.strictEqual(info.width, 621);
    assert.strictEqual(info.height, 327);
  });

  it('respects the maxWidth option', async () => {
    subject = new iiif.Processor(`${base}/info.json`, streamResolver, { pathPrefix: 'iiif/2/ab/cd/ef/gh', maxWidth: 600 });
    const result = await subject.execute();
    const info = JSON.parse(result.body);
    assert.strictEqual(info.profile[1].maxWidth, 600);
    assert.strictEqual(info.width, 621);
    assert.strictEqual(info.height, 327);
  });
});

describe('quality', () => {
  qualities.forEach((value) => {
    it(`should produce an image with quality ${value}`, async () => {
      subject = new iiif.Processor(`${base}/full/full/0/${value}.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });
});

describe('format', () => {
  formats.forEach((value) => {
    it(`should produce an image with format ${value}`, async () => {
      subject = new iiif.Processor(`${base}/full/full/0/default.${value}`, streamResolver);
      const result = await subject.execute();
      assert.match(result.contentType, /^image\//);
    });
  });
});

describe('region', () => {
  regions.forEach((value) => {
    it(`should produce an image with region ${value}`, async () => {
      subject = new iiif.Processor(`${base}/${value}/full/0/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });

  it('should require valid region size', async () => {
    subject = new iiif.Processor(`${base}/0,0,0,0/full/0/default.png`, streamResolver);
    assert.rejects(() => subject.execute(), iiif.IIIFError);
  });
});

describe('size', () => {
  sizes.forEach((value) => {
    it(`should produce an image with size ${value}`, async () => {
      subject = new iiif.Processor(`${base}/full/${value}/0/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });

  it('should require valid size', async () => {
    subject = new iiif.Processor(`${base}/full/pct:0/0/default.png`, streamResolver);
    assert.rejects(() => subject.execute(), iiif.IIIFError);
  });
});

describe('rotation', () => {
  rotations.forEach((value) => {
    it(`should produce an image with rotation ${value}`, async () => {
      subject = new iiif.Processor(`${base}/full/full/${value}/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });
});

describe('IIIF transformation', () => {
  beforeEach(() => {
    consoleWarnMock = jest.spyOn(global.console, 'warn').mockImplementation();
    subject = new iiif.Processor(
      `${base}/10,20,30,40/pct:50/45/default.png`,
      streamResolver,
      { dimensionFunction: () => null }
      );
    });
    
    afterEach(() => {
      consoleWarnMock.mockRestore();
    });
    
    it('transforms the image', async () => {
      const result = await subject.execute();
      const size = await probe.sync(result.body);
      
      assert.strictEqual(size.width, 25);
      assert.strictEqual(size.height, 25);
      assert.strictEqual(size.mime, 'image/png');
    });
  });
  
  describe('Two-argument streamResolver', () => {
    beforeEach(() => {
      subject = new iiif.Processor(
      `${base}/10,20,30,40/pct:50/45/default.png`,
      ({id, baseUrl}, callback) => { 
        const stream = streamResolver({id, baseUrl});
        return callback(stream); 
      }
    );
  });

  it('works with the two-argument streamResolver', async () => {
    const result = await subject.execute();
    const size = await probe.sync(result.body);

    assert.strictEqual(size.width, 25);
    assert.strictEqual(size.height, 25);
    assert.strictEqual(size.mime, 'image/png');
  });
})
