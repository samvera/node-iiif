import { Dimensions } from '../types';
import { Formats, Qualities } from '../calculator/v3';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Debug from 'debug';
import type { InfoDocInput, InfoDoc } from '../contracts';

export const profileLink = 'https://iiif.io/api/image/3/level2.json';

const defaultFormats: Set<String> = new Set(['jpg', 'png']);
const defaultQualities: Set<String> = new Set(['default']);
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

export function infoDoc({
  id,
  width,
  height,
  sizes,
  max
}: InfoDocInput): InfoDoc {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };

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
        width: 512,
        height: 512,
        scaleFactors: sizes.map((_v: Dimensions, i: number) => 2 ** i)
      }
    ],
    ...IIIFExtras,
    ...maxAttrs
  };
}
