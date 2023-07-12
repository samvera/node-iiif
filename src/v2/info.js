const { Formats, Qualities } = require('../calculator/v2');
const debug = require('debug')('iiif-processor:v2:info'); // eslint-disable-line no-unused-vars

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

function infoDoc ({ id, width, height, sizes, max }) {
  const maxAttrs = {
    maxWidth: max?.width,
    maxHeight: max?.height,
    maxArea: max?.area
  };

  return {
    '@context': 'http://iiif.io/api/image/2/context.json',
    '@id': id,
    protocol: 'http://iiif.io/api/image',
    width,
    height,
    sizes,
    tiles: [
      { width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }
    ],
    profile: [profileLink, { ...IIIFProfile, ...maxAttrs }]
  };
}

module.exports = { infoDoc, profileLink };
