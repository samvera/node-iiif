import Debug from 'debug';
import type { ImageGeometry } from './types';
import sharp from 'sharp';
import { Readable } from 'stream';
import { getTileSize } from './tile-size';

const debug = Debug('iiif:geometry');

type StreamCallback = (stream: Readable) => Promise<unknown>;

export async function readGeometry(
  withStream: (callback: StreamCallback) => Promise<unknown>,
  geometry: ImageGeometry
): Promise<ImageGeometry> {
  let metadata = {};
  let tileSize = {};
  const result = { ...geometry };

  debug('Initial geometry: %O', geometry);

  if (
    !geometry.width ||
    !geometry.height ||
    !(geometry.pages || geometry.sizes)
  ) {
    await withStream(async (metadataStream) => {
      metadata = await readMetadata(metadataStream);
    });
    debug('Read metadata: %O', metadata);
  }

  if (geometry.tileWidth === undefined || geometry.tileHeight === undefined) {
    await withStream(async (sizeStream) => {
      const size = await getTileSize(sizeStream);
      tileSize = { tileWidth: size.width, tileHeight: size.height };
    });
    debug('Read tile size: %O', tileSize);
  }

  const final = { ...result, ...metadata, ...tileSize };
  debug('Final geometry: %O', final);
  return final;
}

export function calculateGeometry(geometry: ImageGeometry): ImageGeometry {
  if (geometry.sizes) {
    const result: ImageGeometry = { ...geometry };
    if (!geometry.pages) {
      result.pages = geometry.sizes.length;
    }
    if (!geometry.width || !geometry.height) {
      result.width = geometry.sizes[0].width;
      result.height = geometry.sizes[0].height;
    }
    return result;
  }

  if (geometry.width && geometry.height) {
    if (geometry.pages)
      if (geometry.pages === 1) {
        return {
          ...geometry,
          sizes: [{ width: geometry.width, height: geometry.height }]
        };
      }
    if (geometry.pages > 1) {
      return calculateSizesFromPages(geometry);
    }
    if (geometry.tileWidth && geometry.tileHeight) {
      return calculateSizesFromTiles(geometry);
    }
  }

  return geometry;
}

async function readMetadata(stream: Readable): Promise<ImageGeometry> {
  const target = sharp({ limitInputPixels: false, page: 0 });

  stream.pipe(target);
  const { autoOrient, ...metadata } = await target.metadata();
  const { width, height, pages } = { ...metadata, ...autoOrient };
  return { width, height, pages };
}

function calculateSizesFromTiles(geometry: ImageGeometry): ImageGeometry {
  const pages =
    Math.max(
      Math.ceil(Math.log2(geometry.width! / geometry.tileWidth!)),
      Math.ceil(Math.log2(geometry.height! / geometry.tileHeight!))
    ) + 1;
  return calculateSizesFromPages({ ...geometry, pages });
}

function calculateSizesFromPages(geometry: ImageGeometry): ImageGeometry {
  const result: ImageGeometry = { ...geometry };
  result.sizes = [{ width: geometry.width, height: geometry.height }];
  let page = 0;
  for (page += 1; page < geometry.pages; page++) {
    const scale = 1 / 2 ** page;
    result.sizes.push({
      width: Math.floor(geometry.width * scale),
      height: Math.floor(geometry.height * scale)
    });
  }
  return result;
}
