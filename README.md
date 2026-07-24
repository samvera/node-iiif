# iiif-processor

[![Build Status](https://github.com/samvera/node-iiif/actions/workflows/test.yml/badge.svg)](https://github.com/samvera/node-iiif/actions/workflows/test.yml) [![Test Coverage](https://coveralls.io/repos/github/samvera/node-iiif/badge.svg)](https://coveralls.io/github/samvera/node-iiif) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fsamvera%2Fnode-iiif.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fsamvera%2Fnode-iiif?ref=badge_shield&issueType=license)

This module provides a full-featured image processor supporting the IIIF Image API versions [2.1](https://iiif.io/api/image/2.1/) and 
[3.0](https://iiif.io/api/image/3.0/). It covers only the image processing pipeline itself, leaving input and output to the caller.

## Install with NPM

```sh
npm install iiif-processor --save
```

## Usage

```typescript
import { Processor } from "iiif-processor";

const processor = new Processor(url, streamResolver, opts);
```

* `url` (string, required) - the URL of the IIIF resource to process
* `streamResolver` (async function, required) – returns a Promise of a readable image stream for a given request ([see below](#stream-resolver)); the legacy two-argument callback form is deprecated
* `opts`:
  * `geometryFunction` (function) – a callback function that returns the image geometry for a given request ([see below](#geometry-function))
  * `max` (object) – optional maximum size constraints of an image that can be returned
    * `width` (integer) - the maximum pixel width of the returned image
    * `height` (integer) - the maximum pixel height of the returned image
    * `area` (integer) - the maximum total number of pixels in the returned image
  * `includeMetadata` (boolean) – if `true`, all metadata from the source image will be copied to the result
  * `debugBorder` (boolean) – if `true`, add a 1px red border to every generated image (for tile debugging)
  * `density` (integer) – the pixel density to be included in the result image in pixels per inch
    * This has no effect whatsoever on the size of the image that gets returned; it's simply for convenience when using
      the resulting image in software that calculates a default print size based on the height, width, and density
  * `pageThreshold` (integer) – the fudge factor (in number of pixels) to mitigate rounding errors in pyramid page selection (default: `1`)
  * `pathPrefix` (string) – the template used to extract the IIIF version and API parameters from the URL path (default: `/iiif/{{version}}/`) ([see below](#path-prefix))
  * `version` (number) – the major version (`2` or `3`) of the IIIF Image API to use (default: inferred from `/iiif/{version}/`)
  * `c2pa` (object) – optional configuration for signing generated images with C2PA content credentials ([see below](#c2pa-content-credentials))

## Examples

### Full Self-Contained Application

See the [TinyIIIF](./examples/tiny-iiif/README.md) example.

### Stream Resolver

The calling function must supply the processor with a Stream Resolver that returns a
Promise of an open [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).
It receives information about the request [(`id` and `baseUrl`)](#id--baseurl).

#### Pairtree File Source

```typescript
async function streamResolver({ id, baseUrl }) {
  let imagePath = "/path/to/image/root/" + id.match(/.{1,2}/g).join("/") + "/image.tif";
  return createReadStream(imagePath);
}
```

The Stream Resolver can also take an async callback as its second parameter, in which
case it should return the value of applying the callback to the stream. This allows
the function to do its own cleanup.

#### Amazon S3 Bucket Source

```typescript
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

async function streamResolver({ id, baseUrl }) {
  const s3 = new S3Client();
  const command = new GetObjectCommand({
    Bucket: "my-tiff-bucket",
    Key: `${id}.tif`
  });
  const response = await s3.send(command);
  const body = response.Body;

  if (!stream) {
    throw new Error(`Could not fetch object from S3: ${id}`);
  }

  return stream;
}
```

Note: The two-argument callback form is still supported but deprecated; prefer the
promise-based resolver shown above. If you currently return a stream synchronously,
wrap it with `Promise.resolve()` or mark your function `async`.

### Geometry Function

The calling function can also supply the processor with an optional Geometry callback that takes information about the request [(`id` and `baseUrl`)](#id--baseurl) and returns information about the geometry of the source image. This allows for caching dimensions and other information, and avoiding an expensive image request.

The function should return an object conforming to the `ImageGeometry` type, for example:

```typescript
{
  width: 4096,
  height: 3072,
  pages: 6,
  sizes: [
    {width: 4096, height: 3072},
    {width: 2048, height: 1536},
    {width: 1024, height: 768},
    {width: 512, height: 384},
    {width: 256, height: 192},
    {width: 128, height: 96}
  ],
  tileWidth: 128,
  tileHeight: 128
}
```

Any information not included will be calculated or probed for, if possible. For example:

| Fields Provided            | Fields Calculated | Fields Probed              |
| -------------------------- | ----------------- | -------------------------- |
| none                       | `sizes`           | `width`, `height`, `pages` |
| `width`, `height`, `sizes` | `pages`           |                            |
| `width`, `height`, `pages` | `sizes`           |                            |

#### Tile Size

Tile size information is independent of dimension and page information, and is only checked
when rendering the image information document (`info.json`). If either `tileWidth` or `tileHeight`
is left `undefined` by the Geometry Function, the image stream will be probed for them, which 
can be an expensive operation. If both are provided – even if they are `null` – the given values 
will be used. If tile sizes are `null`, the `tiles` property will be omitted from the information
document.

The following example shows a Geometry Function that looks up the width, height, and number of 
pages in the target image in a database and returns them along with hardcoded tile sizes. The 
`sizes` array will be automatically calculated by the processor.

```typescript
async function geometryFunction({ id: string, baseUrl: string }): Promise<ImageGeometry> {
  let dimensions = lookDimensionsUpInDatabase(id, baseUrl);
  return { 
    width: dimensions.width, 
    height: dimensions.height,
    pages: dimensions.pages,
    tileWidth: 128,
    tileHeight: 128
  };
}
```

### Path Prefix

The `pathPrefix` constructor option provides a tremendous amount of flexibility in how IIIF URLs are structured. The prefix includes one placeholder `{{version}}`, indicating the major version of the IIIF Image API to use when interpreting the rest of the path.

* The `pathPrefix` _must_ start and end with `/`.
* The `pathPrefix` _must_ include the `{{version}}` placeholder _unless_ the `version` constructor option is specified. If both are present, the constructor option will take precedence.
* To allow for maximum flexibility, the `pathPrefix` is interpreted as a [JavaScript regular expression](https://www.w3schools.com/jsref/jsref_obj_regexp.asp). For example, `/.+?/iiif/{{version}}/` would allow your path to have arbitrary path elements before `/iiif/`. Be careful when including greedy quantifiers (e.g., `+` as opposed to `+?`), as they may produce unexpected results. `/` characters are treated as literal path separators, not regular expression delimiters as they would be in JavaScript code.

### C2PA Content Credentials

[C2PA](https://c2pa.org/) (the Coalition for Content Provenance and Authenticity) is an open technical standard for
attaching verifiable, tamper-evident provenance information — "Content Credentials" — to media files: where it
came from, and what's been done to it. See [How It Works](https://contentcredentials.org/how-it-works) for a
plain-language overview, [Verify](https://contentcredentials.org/verify) for a tool that inspects a file's content
credentials, and the [C2PA Technical Specification](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html)
for the full standard.

If a `c2pa` option is supplied, every image `iiif-processor` generates is signed with a manifest recording the IIIF
transformation that was applied (region, size, rotation, quality, and format), using
[`c2pa-node`](https://github.com/contentauth/c2pa-js), the official Node.js C2PA library.

`@contentauth/c2pa-node` is an *optional* dependency of `iiif-processor` — it bundles a native addon, and most
consumers don't need it. If it isn't installed, or fails to load for any reason, `iiif-processor` logs a warning
and returns images unsigned rather than failing the request. To enable signing, install it alongside
`iiif-processor`:

```sh
npm install @contentauth/c2pa-node --save
```

Then pass a `c2pa` option to the `Processor` constructor:

```typescript
import { readFileSync } from "fs";
import { Processor } from "iiif-processor";

const processor = new Processor(url, streamResolver, {
  c2pa: {
    certificate: readFileSync("./signing-cert.pem", "utf8"),
    key: readFileSync("./signing-key.pem", "utf8")
  }
});
```

* `certificate` (string, required) – a PEM-encoded X.509 certificate (or certificate chain) matching `key`, used to
  sign the manifest. This needs to be an EC certificate on the P-256 curve, since `es256` is currently the only
  supported signing algorithm. For production use, it needs to chain to a Certificate Authority recognized by
  C2PA's trust requirements; a self-signed or otherwise untrusted certificate will still produce a valid manifest,
  but validators will flag the signer as untrusted.
* `key` (string, required) – the PEM-encoded EC (P-256) private key matching `certificate`.
* `mimeType` (string) – the MIME type of the *source* asset, used to read any existing content credentials from it
  so they can be carried forward as a parent ingredient. Defaults to `application/octet-stream` (no existing
  manifest will be read).
* `tsaUrl` (string) – the URL of an [RFC 3161](https://en.wikipedia.org/wiki/Trusted_timestamping) Time Stamp
  Authority. If omitted, the manifest won't include a trusted timestamp, which some validators flag as an issue.
* `reserveSize` (number) – bytes reserved in the asset for the signature block (default: `20000`). The certificate
  chain and, if configured, the timestamp authority's response both need to fit in this space; if signing fails
  with a "COSE Signature too big" error, increase this value.

`certificate` and `key` need to contain real newlines. If yours come from an environment variable or a JSON config
file where newlines were flattened into literal `\n` sequences (a common issue with, e.g., `.vscode/launch.json`),
convert them back before passing them in (e.g., `key.replace(/\\n/g, "\n")`).

Each signed image records a `c2pa.edited` action identifying `iiif-processor` as the software agent and describing
the specific IIIF transform that was applied. If `debugBorder` is also enabled, a second action records that a
debug border was applied.

### Processing

Primary processing is handled through the `Processor` class's `execute()` method. There are three possible return types:

- `ContentResult` (`type: "content"`) - includes a `canonicalLink`, a `profileLink`, a `contentType`, and a `body`
- `RedirectResult` (`type: "redirect"`) - includes a redirect `location` (used when the URL ends with the ID and should redirect to `info.json`)
- `ErrorResult` (`type: "Error"`) - includes an HTTP-compatible `statusCode` (e.g., `400` for bad requests; `500` for unhandled errors) and a `message`

In addition, certain error conditions may result in the throwing of an `IIIFError`, which also includes `statusCode` and `message` properties.

#### Promise
```typescript
import { Processor } from "iiif-processor";

let url = "http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg"
let processor = new Processor(url, streamResolver, { geometryFunction });
processor.execute()
  .then(result => handleResult(result))
  .catch(err => handleError(err));
```

#### Async/Await
```typescript
import { Processor } from "iiif-processor";

let url = "http://iiif.example.com/iiif/2/abcdefgh/full/400,/0/default.jpg"
let processor = new Processor(url, streamResolver, { geometryFunction });
try {
  return await processor.execute();
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


[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fsamvera%2Fnode-iiif.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fsamvera%2Fnode-iiif?ref=badge_large)