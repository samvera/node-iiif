# iiif-processor

[![Build Status](https://circleci.com/gh/samvera/node-iiif.svg?style=svg)](https://circleci.com/gh/samvera/node-iiif)
[![Maintainability](https://api.codeclimate.com/v1/badges/b5da41e405f8c020c273/maintainability)](https://codeclimate.com/github/samvera/node-iiif/maintainability)
[![Test Coverage](https://coveralls.io/repos/github/samvera/node-iiif/badge.svg)](https://coveralls.io/github/samvera/node-iiif)

This module provides a full-featured image processor supporting the IIIF Image API versions [2.1](https://iiif.io/api/image/2.1/) and 
[3.0](https://iiif.io/api/image/3.0/). It covers only the image processing pipeline itself, leaving input and output to the caller.

## Install with NPM

```sh
npm install iiif-processor --save
```

## Usage

```javascript
const IIIF = require('iiif-processor');

const processor = new IIIF.Processor(version, url, streamResolver, opts);
```

* `version` (number, required) – the version of the IIIF spec to use (`2` or `3`)
* `url` (string, required) - the URL of the IIIF resource to process
* `streamResolver` (function, required) – a callback function that returns a readable image stream for a given request ([see below](#stream-resolver))
* `opts`:
  * `dimensionFunction` (function) – a callback function that returns the image dimensions for a given request ([see below](#dimension-function))
  * `max` (object) – optional maximum size constraints of an image that can be returned
    * `width` (integer) - the maximum pixel width of the returned image
    * `height` (integer) - the maximum pixel height of the returned image
    * `area` (integer) - the maximum total number of pixels in the returned image
  * `includeMetadata` (boolean) – if `true`, all metadata from the source image will be copied to the result
  * `density` (integer) – the pixel density to be included in the result image in pixels per inch
    * This has no effect whatsoever on the size of the image that gets returned; it's simply for convenience when using
      the resulting image in software that calculates a default print size based on the height, width, and density
  * `pathPrefix` (string) – the default prefix that precedes the `id` part of the URL path (default: `/iiif/2/`)

## Examples

### Full Self-Contained Application

See the [TinyIIIF](./examples/tiny-iiif/README.md) example.

### Stream Resolver

The calling function must supply the processor with a Stream Resolver callback
function, which takes information about the request [(`id` and `baseUrl`)](#id--baseurl) and returns an open
[Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) from which the source image can be read.

#### Pairtree File Source

```javascript
function streamResolver({ id, baseUrl }) {
  let imagePath = '/path/to/image/root/' + id.match(/.{1,2}/g).join('/') + '/image.tif';
  return fs.createReadStream(imagePath);
}
```

The Stream Resolver can also take an async callback as its second parameter, in which
case it should return the value of applying the callback to the stream. This allows
the function to do its own cleanup.

#### Amazon S3 Bucket Source

```javascript
const AWS = require('aws-sdk');

async function streamResolver({ id, baseUrl }, callback) {
  let s3 = new AWS.S3();
  let key = id + '.tif';
  let request = s3.getObject({ Bucket: 'my-tiff-bucket', Key: key });
  let stream = request.createReadStream();
  try {
    return await callback(stream);
  } finally {
    stream.end().destroy();
    request.abort();
  }
}
```

### Dimension Function

The calling function can also supply the processor with an optional Dimension callback that takes information about the request [(`id` and `baseUrl`)](#id--baseurl) and returns the dimensions of the source image. This allows for caching dimensions and avoiding an expensive image request.

The function should return either:

* a `{width: w, height: h}` object indicating the dimensions of the source image
* an array of `{width: w, height: h}` objects indicating the dimensions of all of the pages available within the source image, if it is a multi-resolution image (e.g., a pyramidal TIFF), e.g.:
  ```
  [
    { width: 14499, height: 12069 },
    { width: 7249, height: 6034 },
    { width: 3624, height: 3017 },
    { width: 1812, height: 1508 },
    { width: 906, height: 754 },
    { width: 453, height: 377 },
    { width: 226, height: 188 }
  ]
  ```

Providing the dimensions of all available pages allows the processor to choose the most efficient starting image for the size requested.

```javascript
async function dimensionFunction({ id, baseUrl }) {
  let dimensions = lookDimensionsUpInDatabase(id);
  return { width: dimensions.width, height: dimensions.height };
}
```

### Processing

#### Promise
```javascript
const IIIF = require('iiif-processor');

let url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
let processor = new IIIF.Processor(url, streamResolver, { dimensionFunction });
processor.execute()
  .then(result => handleResult(result))
  .catch(err => handleError(err));
```

#### Async/Await
```javascript
const IIIF = require('iiif-processor');

let url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
let processor = new IIIF.Processor(url, streamResolver, { dimensionFunction });
try {
  let result = await processor.execute();
  return result;
} catch (err) {
  handleError(err);
}
```

### `id` / `baseUrl`

The [stream resolver](#stream-resolver) and [dimensions function](#dimension-function) functions both accept an object with
`id` and `baseUrl` specified.

For instance, for the request:

> https://example.org/iiif/assets/42562145-0998-4b67-bab0-6028328f8319.png/10,20,30,40/pct:50/45/default.png

The `id` parameter is `42562145-0998-4b67-bab0-6028328f8319.png` and the `baseUrl` is `https://example.org/iiif/assets`.

## Contributing

Contributions are welcome in the form of bug reports, suggestions, pull requests, and/or documentation.

If you're working on a PR for this project, create a feature branch off of `main`.

This project uses the [debug](https://www.npmjs.com/package/debug) library for selective debugging output. To view all IIIF-related debug messages, set the environment variable `DEBUG=iiif-processor:*`. To view just the main or transformer contexts, set `DEBUG=iiif-processor:main` or `DEBUG=iiif-processor:transform`.

This repository follows the [Samvera Community Code of Conduct](https://samvera.atlassian.net/wiki/spaces/samvera/pages/405212316/Code+of+Conduct) and [language recommendations](https://github.com/samvera/maintenance/blob/main/templates/CONTRIBUTING.md#language).  Please ***do not*** create a branch called `master` for this repository or as part of your pull request; the branch will either need to be removed or renamed before it can be considered for inclusion in the code base and history of this repository.

## License

`node-iiif` is available under [the Apache 2.0 license](LICENSE).
