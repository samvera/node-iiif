/// <reference types="jest" />
'use strict';

import { describe, it, beforeEach, afterEach, jest } from '@jest/globals';
import assert from 'assert';
import fs from 'fs';
import { Processor } from '../../src/processor';
import { IIIFError } from '../../src/error';
import Sharp from 'sharp';
import values from '../fixtures/iiif-values';
const { v2: { qualities, formats, regions, sizes, rotations } } = values as any;

const base = 'https://example.org/iiif/2/ab/cd/ef/gh/i';
const streamResolver: any = async () => fs.createReadStream('./tests/fixtures/samvera.tif');
let subject;
let consoleWarnMock;

describe('info.json', () => {
  it('produces a valid info.json', async () => {
    subject = new Processor(`${base}/info.json`, streamResolver, { pathPrefix: '/iiif/{{version}}/ab/cd/ef/gh/' });
    const result = await subject.execute();
    const info = JSON.parse(result.body);
    assert.strictEqual(info['@id'], 'https://example.org/iiif/2/ab/cd/ef/gh/i');
    assert.strictEqual(info.profile[1].maxWidth, undefined);
    assert.strictEqual(info.width, 621);
    assert.strictEqual(info.height, 327);
  });

  it('respects the maxWidth option', async () => {
    subject = new Processor(`${base}/info.json`, streamResolver, { pathPrefix: '/iiif/{{version}}/ab/cd/ef/gh/', max: { width: 600  }});
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
      subject = new Processor(`${base}/full/full/0/${value}.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });
});

describe('format', () => {
  formats.forEach((value) => {
    it(`should produce an image with format ${value}`, async () => {
      subject = new Processor(`${base}/full/full/0/default.${value}`, streamResolver);
      const result = await subject.execute();
      assert.match(result.contentType, /^image\//);
    });
  });
});

describe('region', () => {
  regions.forEach((value) => {
    it(`should produce an image with region ${value}`, async () => {
      subject = new Processor(`${base}/${value}/full/0/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });

  it('should require valid region size', async () => {
    subject = new Processor(`${base}/0,0,0,0/full/0/default.png`, streamResolver);
    assert.rejects(() => subject.execute(), IIIFError);
  });

  it('constrains the region to the image bounds', async () => {
    subject = new Processor(`${base}/100,100,4000,4000/full/0/default.png`, streamResolver);
    const result = await subject.execute();
    const size = await Sharp(result.body).metadata();
    assert.strictEqual(size.width, 521);
    assert.strictEqual(size.height, 227);
  });

  it('raises an error if the region is invalid', async () => {
    subject = new Processor(`${base}/700,0,627,540/full/0/default.png`, streamResolver);
    assert.rejects(() => subject.execute(), IIIFError);
  });
});

describe('size', () => {
  sizes.forEach((value) => {
    it(`should produce an image with size ${value}`, async () => {
      subject = new Processor(`${base}/full/${value}/0/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });

  it('should require valid size', async () => {
    subject = new Processor(`${base}/full/pct:0/0/default.png`, streamResolver);
    assert.rejects(() => subject.execute(), IIIFError);
  });

  it('should select the correct page for the size', async () => {
    let pipeline;
    subject = new Processor(`${base}/full/pct:40/0/default.png`, streamResolver);
    pipeline = await subject.operations(await subject.dimensions()).pipeline();
    assert.strictEqual(pipeline.options.input.page, 1);
  });

  it('should respect the pixel page buffer', async () => {
    let pipeline;
    subject = new Processor(`${base}/full/312,165/0/default.png`, streamResolver);
    pipeline = await subject.operations(await subject.dimensions()).pipeline();
    assert.strictEqual(pipeline.options.input.page, 1);

    subject = new Processor(`${base}/full/312,165/0/default.png`, streamResolver, { pageThreshold: 0 });
    pipeline = await subject.operations(await subject.dimensions()).pipeline();
    assert.strictEqual(pipeline.options.input.page, 0);
  });
});

describe('rotation', () => {
  rotations.forEach((value) => {
    it(`should produce an image with rotation ${value}`, async () => {
      subject = new Processor(`${base}/full/full/${value}/default.png`, streamResolver);
      const result = await subject.execute();
      assert.strictEqual(result.contentType, 'image/png');
    });
  });
});

describe('IIIF transformation', () => {
  beforeEach(() => {
    consoleWarnMock = jest.spyOn(global.console, 'warn').mockImplementation(() => undefined);
    subject = new Processor(
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
    const size = await Sharp(result.body).metadata();
    
    assert(result.canonicalLink);
    assert(result.profileLink);
    assert.strictEqual(size.width, 25);
    assert.strictEqual(size.height, 25);
    assert.strictEqual(size.format, 'png');
  });
});
  
describe('Two-argument streamResolver', () => {
  beforeEach(() => {
    subject = new Processor(
      `${base}/10,20,30,40/pct:50/45/default.png`,
      async ({id, baseUrl}, callback) => { 
        const stream = await streamResolver({id, baseUrl});
        return callback(stream); 
      }
    );
  });

  it('works with the two-argument streamResolver', async () => {
    const result = await subject.execute();
    const size = await Sharp(result.body).metadata();

    assert.strictEqual(size.width, 25);
    assert.strictEqual(size.height, 25);
    assert.strictEqual(size.format, 'png');
  });
});

describe('Debug border', () => {
  it('should produce an image without a border by default', async () => {
    subject = new Processor(`${base}/full/full/0/default.png`, streamResolver);
    const result = await subject.execute();
    const image = await Sharp(result.body).removeAlpha().raw().toBuffer();
    const pixel = image.readUInt32LE(0);
    assert.strictEqual(pixel, 0xffffffff);
  });

  it('should add a border when `debugBorder` is specified', async () => {
    subject = new Processor(`${base}/full/full/0/default.png`, streamResolver, { debugBorder: true });
    const result = await subject.execute();
    const image = await Sharp(result.body).removeAlpha().raw().toBuffer();
    const pixel = image.readUInt32LE(0);
    assert.strictEqual(pixel, 0xff0000ff);
  });
});
