import { Formats, Qualities } from '../calculator/v2';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Debug from 'debug';
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

export function infoDoc ({ id, width, height, sizes, max }: any) {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  } as any;

  return {
    '@context': 'http://iiif.io/api/image/2/context.json',
    '@id': id,
    protocol: 'http://iiif.io/api/image',
    width,
    height,
    sizes,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v: any, i: number) => 2 ** i) }
    ],
    profile: [profileLink, { ...IIIFProfile, ...maxAttrs }]
  };
}

export { profileLink };
