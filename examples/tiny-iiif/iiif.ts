import { App } from '@tinyhttp/app';
import {
  Processor,
  IIIFError,
  ContentResult,
  ErrorResult,
  ProcessorResult,
  RedirectResult
} from 'iiif-processor';
import fs from 'fs';
import path from 'path';
import { iiifImagePath, iiifpathPrefix, fileTemplate } from './config';

const streamImageFromFile = async ({ id }: { id: string }) => {
  const filename = fileTemplate.replace(/\{\{id\}\}/, id);
  const file = path.join(iiifImagePath, filename);
  if (!fs.existsSync(file)) {
    throw new IIIFError('Not Found', { statusCode: 404 });
  }
  return fs.createReadStream(file);
};

const render = async (req: any, res: any) => {
  try {
    const iiifUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    const iiifProcessor = new Processor(iiifUrl, streamImageFromFile, {
      pathPrefix: iiifpathPrefix,
      debugBorder: !!process.env.DEBUG_IIIF_BORDER
    });
    const result: ProcessorResult = await iiifProcessor.execute();
    switch (result.type) {
      case 'content':
        return res
          .set('Content-Type', result.contentType)
          .set('Link', [
            `<${result.canonicalLink}>;rel="canonical"`,
            `<${result.profileLink}>;rel="profile"`
          ])
          .status(200)
          .send(result.body);
      case 'redirect':
        return res.redirect(result.location, 302);
      case 'error':
        return res
          .set('Content-Type', 'text/plain')
          .status(result.statusCode)
          .send(result.message);
    }
  } catch (err) {
    return res
      .set('Content-Type', 'text/plain')
      .status(err.statusCode || 500)
      .send(err.message);
  }
};

function createRouter (version: number) {
  const router = new App();

  router.use((_req, res, next) => {
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Methods', 'OPTIONS, HEAD, GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Origin', '*');
    next();
  });

  router.options('*', (_req, res) => {
    res.status(204).send('');
  });
  router.get('/', (_req, res) => res.status(200).send(`IIIF v${version}.x endpoint OK`));
  router.get('/:id', render);
  router.get('/:id/info.json', render);
  router.get('/:id/:region/:size/:rotation/:filename', render);

  return router;
}

export default createRouter;
