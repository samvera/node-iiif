import { App } from '@tinyhttp/app';
import iiif from 'iiif-processor';
const { Processor } = iiif;
import fs from 'fs';
import path from 'path';
import { iiifImagePath, iiifpathPrefix, fileTemplate } from './config.js';

function createRouter(version) {
  const streamImageFromFile = ({ id }) => {
    const filename = fileTemplate.replace(/\{\{id\}\}/, id);
    const file = path.join(iiifImagePath, filename);
    if (!fs.existsSync(file)) {
      throw new IIIF.Error("Not Found", { statusCode: 404 });
    }
    return fs.createReadStream(file);
  }

  const render = async (req, res) => {
    if (!req.params?.filename == null) {
      req.params.filename = "info.json";
    }

    try {
      const iiifUrl = `${req.protocol}://${req.get("host")}${req.path}`;
      const iiifProcessor = new Processor(iiifUrl, streamImageFromFile, { pathPrefix: iiifpathPrefix, debugBorder: !!process.env.DEBUG_IIIF_BORDER });
      const result = await iiifProcessor.execute();
      return res
        .set("Content-Type", result.contentType)
        .set("Link", [`<${result.canonicalLink}>;rel="canonical"`, `<${result.profileLink}>;rel="profile"`])
        .status(200)
        .send(result.body);
    } catch (err) {
      const statusCode = err.statusCode || 502;
      return res.status(statusCode).send(err.message);
    }
  }

  const router = new App();

  // Add permissive CORS headers to response
  router.use((req, res, next) => {
    res.set("Access-Control-Allow-Headers", "*");
    res.set(
      "Access-Control-Allow-Methods",
      "OPTIONS, HEAD, GET, POST, PUT, DELETE"
    );
    res.set("Access-Control-Allow-Origin", "*");
    next();
  });

  // Respond with 204 NO CONTENT to all OPTIONS requests
  router.options(/^.*$/, (_req, res) => {
    res.status(204).send("");
  });

  router.get("/", function (_req, res) {
    return res.status(200).send(`IIIF v${version}.x endpoint OK`);
  });

  router.get("/:id", render);
  router.get("/:id/info.json", render);
  router.get("/:id/:region/:size/:rotation/:filename", render);

  return router;
}

export default createRouter;
