#!/usr/bin/env node

import { App } from '@tinyhttp/app';
import { logger } from '@tinyhttp/logger';
import serveStatic from 'serve-static';
import { port, iiifImagePath } from './config.js';
import IIIFRouter from './iiif.js';

const app = new App({ settings: { networkExtensions: true } });

app
  .use(logger())
  .use('/iiif/2', IIIFRouter(2))
  .use('/iiif/3', IIIFRouter(3))
  .use('/openseadragon', serveStatic('./node_modules/openseadragon/build/openseadragon'))
  .use('/images', serveStatic('./node_modules/openseadragon/build/openseadragon/images'))
  .use('/', serveStatic('./public'))
  .listen(port, () => console.log(`Serving IIIF images from ${iiifImagePath} on http://localhost:${port}`));
