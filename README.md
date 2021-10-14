# iiif-processor

[![Build Status](https://circleci.com/gh/samvera-labs/node-iiif.svg?style=svg)](https://circleci.com/gh/samvera-labs/node-iiif)
[![Maintainability](https://api.codeclimate.com/v1/badges/1f771d90d694b2798fb5/maintainability)](https://codeclimate.com/github/samvera-labs/node-iiif/maintainability)
[![Test Coverage](https://coveralls.io/repos/github/samvera-labs/node-iiif/badge.svg)](https://coveralls.io/github/samvera-labs/node-iiif)

This module provides a full-featured [IIIF Image API 2.1](https://iiif.io/api/image/2.1/) image processor. It covers only the image processing pipeline itself, leaving input and output to the caller.

## Install with NPM

```sh
npm install iiif-processor --save
```

## Examples

### Stream Resolver

The calling function must supply the processor with a Stream Resolver callback
function, which takes an ID and returns an open [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) from which the source image can be read.

#### Pairtree File Source
```javascript
function streamResolver(id) {
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

async function streamResolver(id, callback) {
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

### Dimension Callback

The calling function can also supply the processor with an optional Dimension
callback that takes an ID and returns a `{width: w, height: h}` object. This
allows for caching dimensions and avoiding an expensive image request.

```javascript
async function dimensionResolver(id, callback) {
  let dimensions = lookDimensionsUpInDatabase(id);
  return { width: dimensions.width, height: dimensions.height };
}
```

### Processing

#### Promise
```javascript
const IIIF = require('iiif-processor');

let url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
let processor = new IIIF.Processor(url, streamResolver);
processor.execute()
  .then(result => return result)
  .catch(err => handleError(err));
```

#### Async/Await
```javascript
const IIIF = require('iiif-processor');

let url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
let processor = new IIIF.Processor(url, streamResolver, dimensionResolver);
try {
  let result = await processor.execute();
  return result;
} catch (err) {
  handleError(err);
}
```

### Contributing

Contributions are welcome in the form of bug reports, suggestions, pull requests, and/or documentation.

If you're working on a PR for this project, create a feature branch off of `main`.

This repository follows the [Samvera Community Code of Conduct](https://samvera.atlassian.net/wiki/spaces/samvera/pages/405212316/Code+of+Conduct) and [language recommendations](https://github.com/samvera/maintenance/blob/master/templates/CONTRIBUTING.md#language).  Please ***do not*** create a branch called `master` for this repository or as part of your pull request; the branch will either need to be removed or renamed before it can be considered for inclusion in the code base and history of this repository.

### License

`node-iiif` is available under [the Apache 2.0 license](LICENSE).
