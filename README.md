# iiif-processor

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
  var imagePath = '/path/to/image/root/' + id.match(/.{1,2}/g).join('/') + '/image.tif'
  return fs.createReadStream(imagePath);
}
```

#### Amazon S3 Bucket Source
```javascript
const AWS = require('aws-sdk');

function streamResolver(id) {
  var s3 = new AWS.S3();
  var key = id + '.tif';
  return s3.getObject({ Bucket: 'my-tiff-bucket', Key: key }).createReadStream();
}
```

### Processing

#### Promise
```javascript
const IIIF = require('iiif-processor');

var url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
var processor = new IIIF.Processor(url, streamResolver);
processor.execute()
  .then(result => return result)
  .catch(err => handleError(err));
```

#### Async/Await
```javascript
const IIIF = require('iiif-processor');

var url = 'http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg'
var processor = new IIIF.Processor(url, streamResolver);
try {
  var result = await processor.execute();
  return result;
} catch (err) {
  handleError(err);
}
```

### Contributing

Contributions are welcome in the form of bug reports, suggestions, pull requests,
and/or documentation.

### Licensing

Copyright 2019 Northwestern University and contributors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
[https://www.apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.