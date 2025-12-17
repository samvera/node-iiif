/// <reference types="jest" />
'use strict';

import { describe, it, beforeEach } from '@jest/globals';
import assert from 'assert';
import { Calculator } from '../../src/calculator/v3';
import { IIIFError } from '../../src/error';
import values from '../fixtures/iiif-values';
const { v3: { qualities, formats, regions, sizes, rotations } } = values as any;

let subject;

describe('parsePath', () => {
  it('properly parses a IIIF path', () => {
    const { id, region, size, rotation, quality, format } = Calculator.parsePath('/abc-123/500,500,256,256/pct:75/45/bitonal.png');
    assert.equal(id, 'abc-123');
    assert.equal(region, '500,500,256,256');
    assert.equal(size, 'pct:75');
    assert.equal(rotation, '45');
    assert.equal(quality, 'bitonal');
    assert.equal(format, 'png');
  });

  it('throws a IIIFError when an invalid path is passed', () => {
    ['', '/abc-123/blergh/full/0/default.jpg', '/abc-123/full/full/50/0/default.jpg']
    .forEach((value) => assert.throws(() => Calculator.parsePath(value)));
  });
});

describe('Calculator', () => {
  describe('basic operation', () => {
    beforeEach(() => {
      subject = new Calculator({ width: 1024, height: 768 });
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

      subject = new Calculator({ width: 768, height: 1024 });
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

  describe('constraints', () => {
    it('respects maxWidth', () => {
      subject = new Calculator({ width: 1024, height: 768 }, { max: { width: 1536 } });

      const expected = {
        region: { left: 512, top: 384, width: 256, height: 192 },
        size: { fit: 'fill', width: 384, height: 288 },
        rotation: { flop: false, degree: 45 },
        quality: 'default',
        format: { type: 'jpg', density: 600 },
        fullSize: { width: 1536, height: 1152 },
        upscale: true
      };

      subject.region('pct:50,50,25,25').size('^512,384').rotation('45').quality('default').format('jpg', 600);
      assert.deepEqual(subject.info(), expected);
    });

    it('respects maxHeight', () => {
      subject = new Calculator({ width: 1024, height: 768 }, { max: { height: 1024 } });

      const expected = {
        region: { left: 512, top: 384, width: 256, height: 192 },
        size: { fit: 'fill', width: 341, height: 256 },
        rotation: { flop: false, degree: 45 },
        quality: 'default',
        format: { type: 'jpg', density: 600 },
        fullSize: { width: 1364, height: 1023 },
        upscale: true
      };

      subject.region('pct:50,50,25,25').size('^512,384').rotation('45').quality('default').format('jpg', 600);
      assert.deepEqual(subject.info(), expected);
    });

    it('respects maxArea', () => {
      subject = new Calculator({ width: 1024, height: 768 }, { max: { area: 2359296 } });

      const expected = {
        region: { left: 512, top: 384, width: 256, height: 192 },
        size: { fit: 'fill', width: 384, height: 288 },
        rotation: { flop: false, degree: 45 },
        quality: 'default',
        format: { type: 'jpg', density: 600 },
        fullSize: { width: 1536, height: 1152 },
        upscale: true
      };

      subject.region('pct:50,50,25,25').size('^512,384').rotation('45').quality('default').format('jpg', 600);
      assert.deepEqual(subject.info(), expected);
    });

    it ('does not upscale by default', () => {
      subject = new Calculator({ width: 1024, height: 768 });

      assert.throws(() => {
        subject
          .region('pct:50,50,25,25')
          .size('512,384')
          .rotation('45')
          .quality('default')
          .format('jpg', 600);
      }, IIIFError);
    });

    it('upscales when requested', () => {
      const expected = {
        region: { left: 512, top: 384, width: 256, height: 192 },
        size: { fit: 'fill', width: 512, height: 384 },
        rotation: { flop: false, degree: 45 },
        quality: 'default',
        format: { type: 'jpg', density: 600 },
        fullSize: { width: 2048, height: 1536 },
        upscale: true
      };

      subject.region('pct:50,50,25,25').size('^512,384').rotation('45').quality('default').format('jpg', 600);
      assert.deepEqual(subject.info(), expected);
    });
  });
});
