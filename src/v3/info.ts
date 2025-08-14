import { Formats, Qualities } from '../calculator/v3';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Debug from 'debug';

export const profileLink = 'https://iiif.io/api/image/3/level2.json';

const ComplianceProfile = {
  level: 'level2',
  uri: profileLink,
  qualities: new Set(['default']),
  formats: new Set(['jpg', 'png'])
};

const IIIFExtras = {
  extraFormats: new Set(Formats.filter((format) => !(ComplianceProfile.formats as Set<string>).has(format))),
  extraQualities: new Set(Qualities.filter((quality) => !(ComplianceProfile.qualities as Set<string>).has(quality))),
  extraFeatures: [
    'canonicalLinkHeader',
    'mirroring',
    'profileLinkHeader',
    'rotationArbitrary',
    'sizeByDistortedWh',
    'sizeByForcedWh',
    'sizeByWhListed',
    'sizeUpscaling'
  ]
};

export function infoDoc ({ id, width, height, sizes, max }: any) {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  } as any;

  return {
    '@context': 'http://iiif.io/api/image/3/context.json',
    id,
    type: 'ImageService3',
    protocol: 'http://iiif.io/api/image',
    width,
    height,
    sizes,
    extraFormats: [...(IIIFExtras.extraFormats as Set<string>)],
    extraQualities: [...(IIIFExtras.extraQualities as Set<string>)],
    extraFeatures: IIIFExtras.extraFeatures,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v: any, i: number) => 2 ** i) }
    ],
    profile: ComplianceProfile,
    ...maxAttrs
  };
}
