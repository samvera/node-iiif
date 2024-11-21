const iiifImagePath = process.env.IIIF_IMAGE_PATH;
const iiifpathPrefix = process.env.IIIF_PATH_TEMPLATE;
const fileTemplate = process.env.IMAGE_FILE_TEMPLATE || '{{id}}.tif';
const port = process.env.PORT || 3000;

export { iiifImagePath, iiifpathPrefix, fileTemplate, port };
