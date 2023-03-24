## Change Log

Only features and major fixes are listed. Everything else can be considered a minor bugfix or maintenance release.

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

- Pass `baseUrl` to `streamResolver` and `dimension` functions
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
- [Dan Wolfe](https://github.com/danthewolfe)
