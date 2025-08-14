"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileLink = void 0;
exports.infoDoc = infoDoc;
const v2_1 = require("../calculator/v2");
const profileLink = 'http://iiif.io/api/image/2/level2.json';
exports.profileLink = profileLink;
const IIIFProfile = {
    formats: new Set(v2_1.Formats),
    qualities: new Set(v2_1.Qualities),
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
function infoDoc({ id, width, height, sizes, max }) {
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
