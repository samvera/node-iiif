export default {
  v2: {
    qualities: ['color', 'gray', 'bitonal', 'default'],
    formats: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
    regions: ['full', 'square', 'pct:5.0,10.0,15.0,20.0', '20,30,100,50'],
    sizes: ['full', 'max', 'pct:50', '300,', ',300', '300,200', '!300,200'],
    rotations: ['0', '90', '!90']
  },
  v3: {
    qualities: ['color', 'gray', 'bitonal', 'default'],
    formats: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
    regions: ['full', 'square', 'pct:5.0,10.0,15.0,20.0', '20,30,100,50'],
    sizes: ['max', '^max', 'pct:50', '^pct:50', '300,', '^300,', '300,', '^300,', ',300', '^,300', '300,200', '^300,200', '!300,200', '^!300,200'],
    rotations: ['0', '90', '!90']
  }
};
