"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileLink = void 0;
exports.infoDoc = infoDoc;
const v3_1 = require("../calculator/v3");
exports.profileLink = 'https://iiif.io/api/image/3/level2.json';
const ComplianceProfile = {
    level: 'level2',
    uri: exports.profileLink,
    qualities: new Set(['default']),
    formats: new Set(['jpg', 'png'])
};
const IIIFExtras = {
    extraFormats: new Set(v3_1.Formats.filter((format) => !ComplianceProfile.formats.has(format))),
    extraQualities: new Set(v3_1.Qualities.filter((quality) => !ComplianceProfile.qualities.has(quality))),
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
function infoDoc({ id, width, height, sizes, max }) {
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
        width,
        height,
        sizes,
        extraFormats: [...IIIFExtras.extraFormats],
        extraQualities: [...IIIFExtras.extraQualities],
        extraFeatures: IIIFExtras.extraFeatures,
        tiles: [
            { width: 512, height: 512, scaleFactors: sizes.map((_v, i) => 2 ** i) }
        ],
        profile: ComplianceProfile,
        ...maxAttrs
    };
}
