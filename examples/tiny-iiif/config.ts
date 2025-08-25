const iiifImagePath = process.env.IIIF_IMAGE_PATH as string;
const iiifpathPrefix = process.env.IIIF_PATH_TEMPLATE as string;
const fileTemplate = (process.env.IMAGE_FILE_TEMPLATE as string) || '{{id}}.tif';
const port = Number(process.env.PORT || 3000);

export { iiifImagePath, iiifpathPrefix, fileTemplate, port };
