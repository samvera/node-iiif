## Change Log

Only features and major fixes are listed. Everything else can be considered a minor bugfix or maintenance release.

##### v5.2.0
- Refactor pipeline creation to simplify scaling
- Add Clover IIIF manifest viewer and sample manifest/images to tiny-iiif example

##### v5.1.0
- Update `pathPrefix` constructor option to accept a `{{version}}` placeholder and RegExp elements (default: `/iiif/{{version}}/`)

##### v5.0.0
- Export `Calculator`
- Make `sharp` an optional dependency for those who just want to use `Calculator`

##### v4.0.0
- Add support for [IIIF Image API v3.0.0](https://iiif.io/api/image/3.0/) alongside support for [v2.1.1](https://iiif.io/api/image/2.1/)
- Add `canonicalLink` and `profileLink` properties to the response to support the respective link header features (see [example](./examples/tiny-iiif/iiif.js#L28) of how to use this)
- Add `version` to `IIIF.Processor` constructor options
- [BREAKING CHANGE] The `maxWidth` option was changed to `max: { width, height, area }` in order to 
  support the IIIF `maxHeight` and `maxArea` constraints 

##### v3.2.0
- Major refactor to support multi-resolution source images
- Backward-compatible overhaul of `dimensionFunction`
- Split `Calculator` out from `Operations` to make certain pre-transform information available with low overhead
- Use `sharp.metadata()` instead of `probe-image-size` in default dimension function

##### v3.1.0

- Support dimension probing for JPEG 2000 images

##### v3.0.0

- Add `pathPrefix` option (default: `/iiif/2/`) to constructor instead of popping a specific number of path segments off of the end of the URL

##### v2.0.0

- [BREAKING CHANGE] The `id` parameter passed to the [stream resolver](#stream-resolver) and 
  [dimensions callback](#dimension-function) was changed from a `string` to an `object` containing 
  the `id` and `baseUrl`.

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
- Use a consistent name for dimensions function in `README.md`

##### v1.0.0

- Add pixel density option
- Improve documentation 
- Full test coverage

##### v0.3.6

- Allow transformation to include existing metadata

##### v0.3.5

- Allow `.tiff` and `.webp` requests
- Accept `.tif` and `.jpeg`

##### v0.3.0

- Add optional dimension function and `maxWidth` parameter to initializer

##### v0.2.0

- Initial release

# Contributors

- [Michael B. Klein](https://github.com/mbklein)
- [Kate Lynch](https://github.com/kelynch)
- [Ben Limmer](https://github.com/blimmer)
- [Theia Wolfe](https://github.com/theiawolfe)
