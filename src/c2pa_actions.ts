export type C2PAActionParameters = { 
  region: string;
  size: string;
  rotation: string;
  quality: string;
  format: string;
  debugBorder: boolean;
};

export function c2paActions(softwareAgent: string, { region, size, rotation, quality, format, debugBorder }: C2PAActionParameters) {
  if (!softwareAgent) throw new Error('softwareAgent is required');
  
  const actions = [];

  if (region !== 'full') {
    actions.push({
      action: 'c2pa.cropped',
      softwareAgent,
      parameters: {
        description: `Cropped image using IIIF region: "${region}"`
      }
    });
  }

  if (!['full', 'max'].includes(size)) {
    actions.push({
      action: 'c2pa.resized',
      softwareAgent,
      parameters: {
        description: `Resized image using IIIF size: "${size}"`
      }
    });
  }

  if (rotation !== '0') {
    actions.push({
      action: 'c2pa.edited',
      softwareAgent,
      parameters: {
        description: `Rotated image using IIIF rotation: "${rotation}"`
      }
    });
  }

  if (quality !== 'default') {
    actions.push({
      action: 'c2pa.edited',
      softwareAgent,
      parameters: {
        description: `Changed image quality using IIIF quality: "${quality}"`
      }
    });
  }

  if (debugBorder) {
    actions.push({
      action: 'c2pa.edited',
      softwareAgent,
      parameters: {
        description: `Added 1px red border to image`
      }
    });
  }

  actions.push({
    action: 'c2pa.transcoded',
    softwareAgent,
    parameters: {
      outputFormat: format,
      description: `Transcoded image using IIIF format: "${format}"`
    }
  });

  return actions;
}