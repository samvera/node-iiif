#!/usr/bin/env node

import { App } from '@tinyhttp/app';
import { logger } from '@tinyhttp/logger';
import { port, iiifImagePath } from './config.js';
import iiif2 from './iiif2.js';

const app = new App({ settings: { networkExtensions: true } });

app
  .use(logger())
  .get('/', (_req, res) => res.redirect('/iiif/2'))
  .use('/iiif/2', iiif2)
  .listen(port, () => console.log(`Serving IIIF images from ${iiifImagePath} on http://localhost:${port}`));
