const { Formats, Qualities } = require('../calculator/v3');
const debug = require('debug')('iiif-processor:v3:info'); // eslint-disable-line no-unused-vars

const profileLink = 'https://iiif.io/api/image/3/level2.json';
const ComplianceProfile = {
  level: 'level2',
  uri: profileLink,
  qualities: new Set(['default']),
  formats: new Set(['jpg', 'png'])
};

const IIIFExtras = {
  extraFormats: new Set(Formats.filter((format) => !ComplianceProfile.formats.has(format))),
  extraQualities: new Set(Qualities.filter((quality) => !ComplianceProfile.qualities.has(quality))),
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

function infoDoc ({ id, width, height, sizes, max }) {
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
    profile: ComplianceProfile.level,
    width,
    height,
    sizes,
    ...maxAttrs,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }
    ],
    ...IIIFExtras
  };
}

module.exports = { infoDoc, profileLink };
