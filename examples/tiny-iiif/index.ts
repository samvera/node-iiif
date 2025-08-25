#!/usr/bin/env node

import { App } from '@tinyhttp/app';
import { logger } from '@tinyhttp/logger';
import serveStatic from 'serve-static';
import { port, iiifImagePath } from './config';
import IIIFRouter from './iiif';

const setHeaders = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
};

const decodePath = (req: any, _res: any, next: any) => {
  if (req.path) {
    req.path = decodeURIComponent(req.path);
  }
  if (req.originalUrl) {
    req.originalUrl = decodeURIComponent(req.originalUrl);
  }
  next();
};

const app = new App({ settings: { networkExtensions: true } });

app
  .use(decodePath)
  .use(logger({ emoji: true }))
  .use('/iiif/2', IIIFRouter(2))
  .use('/iiif/3', IIIFRouter(3))
  .use('/openseadragon', serveStatic('./node_modules/openseadragon/build/openseadragon'))
  .use('/images', serveStatic('./node_modules/openseadragon/build/openseadragon/images'))
  .use('/', serveStatic('./public', { setHeaders }))
  .listen(port, () => console.log(`Serving IIIF images from ${iiifImagePath} on http://localhost:${port}`));
