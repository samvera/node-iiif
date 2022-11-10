const iiifImagePath = process.env.IIIF_IMAGE_PATH;
const fileTemplate = process.env.IMAGE_FILE_TEMPLATE || '{{id}}.tif';
const port = process.env.PORT || 3000;

export { iiifImagePath, fileTemplate, port };
