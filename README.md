# iiif-processor

[![Build Status](https://circleci.com/gh/samvera/node-iiif.svg?style=svg)](https://circleci.com/gh/samvera/node-iiif)
[![Maintainability](https://api.codeclimate.com/v1/badges/b5da41e405f8c020c273/maintainability)](https://codeclimate.com/github/samvera/node-iiif/maintainability)
[![Test Coverage](https://coveralls.io/repos/github/samvera/node-iiif/badge.svg)](https://coveralls.io/github/samvera/node-iiif)

This module provides a full-featured [IIIF Image API 2.1](https://iiif.io/api/image/2.1/) image processor. It covers only the image processing pipeline itself, leaving input and output to the caller.

## Install with NPM

```sh
npm install iiif-processor --save
```

## Usage

```javascript
const IIIF = require('iiif-processor');

const processor = new IIIF.Processor(url, streamResolver, opts);
```

* `streamResolver` (function, required) – a callback function that returns a readable image stream for a given request (see below)
* `opts`:
  * `dimensionFunction` (function) – a callback function that returns the image dimensions for a given request (see below)
  * `maxWidth` (integer) – the maximum width of an image that can be returned
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

The calling function can also supply the processor with an optional Dimension
callback that takes information about the request [(`id` and `baseUrl`)](#id--baseurl) and returns a
`{width: w, height: h}` object.
This allows for caching dimensions and avoiding an expensive image request.

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

### Breaking Changes

#### v1 -> v2

* The `id` parameter passed to the [stream resolver](#stream-resolver) and [dimensions callback](#dimension-function) was
  changed from a `string` to an `object` containing the `id` and `baseUrl`.

  To maintain the existing behavior, you can use destructuring of the argument. For example:

  ```js
  streamResolver(id) { }               // old
  streamResolver(id, callback) { }     // old
  streamResolver({ id }) { }           // new
  streamResolver({ id }, callback) { } // new

  dimensionFunction(id) { }            // old
  dimensionFunction({ id }) { }        // new
  ```

  See [issue #19](https://github.com/samvera/node-iiif/issues/19) for context on why this change was made.

### Contributing

Contributions are welcome in the form of bug reports, suggestions, pull requests, and/or documentation.

If you're working on a PR for this project, create a feature branch off of `main`.

This repository follows the [Samvera Community Code of Conduct](https://samvera.atlassian.net/wiki/spaces/samvera/pages/405212316/Code+of+Conduct) and [language recommendations](https://github.com/samvera/maintenance/blob/main/templates/CONTRIBUTING.md#language).  Please ***do not*** create a branch called `master` for this repository or as part of your pull request; the branch will either need to be removed or renamed before it can be considered for inclusion in the code base and history of this repository.

### License

`node-iiif` is available under [the Apache 2.0 license](LICENSE).
