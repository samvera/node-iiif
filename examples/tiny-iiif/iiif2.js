import { App } from '@tinyhttp/app';
import IIIF from 'iiif-processor';
import fs from 'fs';
import path from 'path';
import { iiifImagePath, fileTemplate } from './config.js'

function streamImageFromFile ({ id }) {
  const filename = fileTemplate.replace(/\{\{id\}\}/, id);
  const file = path.join(iiifImagePath, filename);
  return fs.createReadStream(file);
}

function render (req, res) {
  if (!req.params?.filename == null) {
    req.params.filename = 'info.json';
  }

  const iiifUrl = `http://${req.get('host')}${req.path}`;
  const iiifProcessor = new IIIF.Processor(iiifUrl, streamImageFromFile);
  iiifProcessor
    .execute()
    .then((result) => {
      res
        .set('Content-Type', result.contentType)
        .status(200)
        .send(result.body);
    })
    .catch((err) => {
      const statusCode = err.statusCode || 502;
      res.status(statusCode).send(err.message + '\n' + err.stack);
    });
};

const router = new App();

// Add permissive CORS headers to response
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Headers', '*');
  res.set(
    'Access-Control-Allow-Methods',
    'OPTIONS, HEAD, GET, POST, PUT, DELETE'
  );
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// Respond with 204 NO CONTENT to all OPTIONS requests
router.options(/^.*$/, (_req, res) => {
  res.status(204).send('');
});

router.get('/', function (_req, res) {
  return res.status(200).send('OK');
});

router.get('/:id', render);
router.get('/:id/info.json', render);
router.get('/:id/:region/:size/:rotation/:filename', render);

export default router;
