# TinyIIIF Server

## Description

TinyIIIF is a small [tinyhttp](https://tinyhttp.v1rtl.site) implementation of a [node-iiif](../README.md) server. It is intended as a no-frills example that can also serve as a development server.

## Usage

### With Built-In Manifest and Sample Images

```shell
$ npm run tiny-iiif
```

### With Your Own Images

```shell
$ IIIF_IMAGE_PATH=/path/to/iiif/images npm run tiny-iiif
```

#### Environment Variables

- `IIIF_IMAGE_PATH`: The base path where images to be served are stored
- `IMAGE_FILE_TEMPLATE`: The template string for translating an image ID into its path relative to `IIIF_IMAGE_PATH`. (Default: `{{id}}.tif`)
- `PORT`: The port the server should listen on (Default: `3000`)

## Running in Docker

```
$ docker build -t tiny-iiif .
$ docker run --rm -ti -v /path/to/iiif/images:/data --publish 3000:3000 tiny-iiif
```

The `IMAGE_FILE_TEMPLATE` can be specified by using Docker's `-e` (or `--env`) parameter:
```
$ docker run --rm -ti -e IMAGE_FILE_TEMPLATE={{id}}.jpg -v /path/to/iiif/images:/data -p 3000:3000 tiny-iiif
```

### Docker Compose Example

```yaml
# docker-compose.yml
---
version: "3.9"
services:
  iiif:
    build: .
    ports: 
      - "3000:3000"
    volumes:
      - "/path/to/iiif/images:/data"
    environment:
      IMAGE_FILE_TEMPLATE: "{{id}}.pyramid.tif"
```
