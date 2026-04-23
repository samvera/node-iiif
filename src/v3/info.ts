import { Dimensions } from '../types';
import { Formats, Qualities } from '../calculator/v3';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Debug from 'debug';
import type { InfoDocInput, InfoDoc } from '../contracts';

export const profileLink = 'https://iiif.io/api/image/3/level2.json';

const DEFAULT_TILE_SIZE = 512;
const defaultFormats: Set<string> = new Set(['jpg', 'png']);
const defaultQualities: Set<string> = new Set(['default']);
const IIIFExtras = {
  extraFeatures: [
    'canonicalLinkHeader',
    'mirroring',
    'profileLinkHeader',
    'rotationArbitrary',
    'sizeByDistortedWh',
    'sizeByForcedWh',
    'sizeByWhListed',
    'sizeUpscaling'
  ],
  extraFormats: new Set(Formats.filter((f) => !defaultFormats.has(f))),
  extraQualities: new Set(Qualities.filter((q) => !defaultQualities.has(q)))
};

export function infoDoc({ id, geometry, max }: InfoDocInput): InfoDoc {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };

  const { width, height, sizes } = geometry;
  return {
    '@context': 'http://iiif.io/api/image/3/context.json',
    id,
    type: 'ImageService3',
    protocol: 'http://iiif.io/api/image',
    profile: 'level2',
    width,
    height,
    sizes,
    tiles: [
      {
        width: geometry.tileWidth || DEFAULT_TILE_SIZE,
        height: geometry.tileHeight || DEFAULT_TILE_SIZE,
        scaleFactors: sizes.map((_v: Dimensions, i: number) => 2 ** i)
      }
    ],
    ...IIIFExtras,
    ...maxAttrs
  };
}
