import { Dimensions } from '../types';
import { Formats, Qualities } from '../calculator/v2';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Debug from 'debug';
import type { InfoDocInput, InfoDoc } from '../contracts';
const profileLink = 'http://iiif.io/api/image/2/level2.json';

const IIIFProfile = {
  formats: new Set(Formats),
  qualities: new Set(Qualities),
  supports: new Set([
    'baseUriRedirect',
    'canonicalLinkHeader',
    'cors',
    'jsonldMediaType',
    'mirroring',
    'profileLinkHeader',
    'regionByPct',
    'regionByPx',
    'regionSquare',
    'rotationArbitrary',
    'rotationBy90s',
    'sizeAboveFull',
    'sizeByConfinedWh',
    'sizeByDistortedWh',
    'sizeByForcedWh',
    'sizeByH',
    'sizeByPct',
    'sizeByW',
    'sizeByWh',
    'sizeByWhListed'
  ])
};

export function infoDoc({ id, geometry, max }: InfoDocInput): InfoDoc {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };

  const { width, height, sizes } = geometry;
  const tiles = geometry.tileWidth
    ? [
        {
          width: geometry.tileWidth,
          height: geometry.tileHeight || geometry.tileWidth,
          scaleFactors: sizes.map((_v: Dimensions, i: number) => 2 ** i)
        }
      ]
    : undefined;
  return {
    '@context': 'http://iiif.io/api/image/2/context.json',
    '@id': id,
    protocol: 'http://iiif.io/api/image',
    width,
    height,
    sizes,
    tiles,
    profile: [profileLink, { ...IIIFProfile, ...maxAttrs }]
  };
}

export { profileLink };
