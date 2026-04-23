/// <reference types="jest" />
'use strict';

import { describe, it, expect } from '@jest/globals';
import { calculateGeometry, readGeometry } from '../src/geometry';
import fs from 'node:fs';

describe('Geometry', () => {
  describe('calculateGeometry', () => {
    it('leaves existing geometry unchanged', () => {
      const geometry = {
        width: 1024,
        height: 768,
        pages: 3,
        tileWidth: 128,
        tileHeight: 128,
        sizes: [
          { width: 1024, height: 768 },
          { width: 512, height: 384 },
          { width: 256, height: 192 }
        ]
      };
      const result = calculateGeometry(geometry);
      expect(result).toEqual(geometry);
    });

    it('calculates sizes for a given width/height/pages', () => {
      const result = calculateGeometry({ width: 1024, height: 768, pages: 3 });
      expect(result.sizes).toHaveLength(3);
      expect(result.sizes[0]).toEqual({ width: 1024, height: 768 });
      expect(result.sizes[1]).toEqual({ width: 512, height: 384 });
      expect(result.sizes[2]).toEqual({ width: 256, height: 192 });
    });

    it('calculates sizes for a given width/height/tile size', () => {
      const result = calculateGeometry({
        width: 1024,
        height: 768,
        tileWidth: 128,
        tileHeight: 128
      });
      expect(result.pages).toEqual(4);
      expect(result.sizes).toHaveLength(4);
      expect(result.sizes[0]).toEqual({ width: 1024, height: 768 });
      expect(result.sizes[1]).toEqual({ width: 512, height: 384 });
      expect(result.sizes[2]).toEqual({ width: 256, height: 192 });
      expect(result.sizes[3]).toEqual({ width: 128, height: 96 });
    });

    it('calculates pages for a given width/height/sizes', () => {
      const result = calculateGeometry({
        width: 1024,
        height: 768,
        sizes: [
          { width: 512, height: 384 },
          { width: 256, height: 192 }
        ]
      });
      expect(result.pages).toEqual(2);
    });

    it('calculates width/height for a given sizes', () => {
      const result = calculateGeometry({
        sizes: [
          { width: 1024, height: 768 },
          { width: 512, height: 384 },
          { width: 256, height: 192 }
        ]
      });
      expect(result.pages).toEqual(3);
      expect(result.width).toEqual(1024);
      expect(result.height).toEqual(768);
    });
  });

  describe('readGeometry', () => {
    it('uses the provided geometry if it is complete', async () => {
      const streamer = async () => {
        throw new Error('Should not be called');
      };
      const geometry = {
        width: 1024,
        height: 768,
        pages: 3,
        tileWidth: 128,
        tileHeight: 128
      };
      const result = await readGeometry(streamer, geometry);
      expect(result).toEqual(geometry);
    });

    it('reads width, height, pages, and tile size', async () => {
      const streamer = async (callback) => {
        await callback(fs.createReadStream('./tests/fixtures/samvera_256.tif'));
      };
      const result = await readGeometry(streamer, {});
      expect(result).toEqual({
        width: 621,
        height: 327,
        pages: 4,
        tileWidth: 256,
        tileHeight: 256
      });
    });

    it('reads width, height, and pages but leaves tile size intact', async () => {
      const streamer = async (callback) => {
        await callback(fs.createReadStream('./tests/fixtures/samvera_256.tif'));
      };
      let result = await readGeometry(streamer, {
        tileWidth: 512,
        tileHeight: 512
      });
      expect(result).toEqual({
        width: 621,
        height: 327,
        pages: 4,
        tileWidth: 512,
        tileHeight: 512
      });

      result = await readGeometry(streamer, {
        tileWidth: null,
        tileHeight: null
      });
      expect(result).toEqual({
        width: 621,
        height: 327,
        pages: 4,
        tileWidth: null,
        tileHeight: null
      });
    });

    it('reads tile size but leaves width/height/pages intact', async () => {
      const streamer = async (callback) => {
        await callback(fs.createReadStream('./tests/fixtures/samvera_128.tif'));
      };
      const result = await readGeometry(streamer, {
        width: 1242,
        height: 654,
        pages: 5
      });
      expect(result).toEqual({
        width: 1242,
        height: 654,
        pages: 5,
        tileWidth: 128,
        tileHeight: 128
      });
    });

    it('handles single-resolution, non-tiled file types', async () => {
      const streamer = async (callback) => {
        await callback(fs.createReadStream('./tests/fixtures/samvera.jpg'));
      };
      const result = await readGeometry(streamer, {});
      expect(result).toEqual({
        width: 621,
        height: 327,
        pages: 1,
        tileWidth: null,
        tileHeight: null
      });
    });

    it('leaves tile size undefined if it cannot be read', async () => {
      const streamer = async (callback) => {
        await callback(fs.createReadStream('./tests/fixtures/samvera.tif'));
      };
      const result = await readGeometry(streamer, {});
      expect(result).toEqual({
        width: 621,
        height: 327,
        pages: 1,
        tileWidth: undefined,
        tileHeight: undefined
      });
    });
  });
});
