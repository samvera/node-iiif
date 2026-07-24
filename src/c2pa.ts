import Debug from 'debug';
import type { Action, BuilderIntent } from '@contentauth/c2pa-types';
import { inspect } from 'node:util';

const debug = Debug('iiif-processor:c2pa');

type SigningLibrary = typeof import('@nulib/c2pa-signing');

let signingLibrary: Promise<SigningLibrary | null> | undefined;

// Signing is provided by @nulib/c2pa-signing, which needs @contentauth/c2pa-node
// (a native addon). Both are optional dependencies: consumers who don't need
// content credentials shouldn't have to install them, so they're loaded lazily
// and failures here just disable signing.
function loadSigningLibrary(): Promise<SigningLibrary | null> {
  if (!signingLibrary) {
    signingLibrary = import('@nulib/c2pa-signing')
      .then(async (library) => {
        await library.loadC2paNode();
        return library;
      })
      .catch((err) => {
        console.warn(
          `C2PA signing dependencies are not available; content credentials will not be added. (${err.message})`
        );
        return null;
      });
  }
  return signingLibrary;
}

/**
 * Configuration for C2PA signing of generated images.
 *
 * @experimental C2PA support may change or be removed in any release, without a deprecation period.
 */
export type C2PASignerOptions = {
  certificate: string;
  key: string;
  softwareAgent: string;
  mimeType?: string;
  tsaUrl?: string;
  reserveSize?: number;
};

/**
 * Adds C2PA content credentials to a generated image, chaining to its source.
 *
 * @experimental C2PA support may change or be removed in any release, without a deprecation period.
 */
export class C2PASigner {
  #buffer: Buffer;
  #stream: NodeJS.ReadableStream;
  opts: C2PASignerOptions;

  constructor(stream: NodeJS.ReadableStream, opts: C2PASignerOptions) {
    this.#stream = stream;
    this.opts = opts;
  }

  async addContentCredentials(
    content: { data: Buffer; type: string },
    intent: BuilderIntent,
    actions: Action[] = []
  ): Promise<Buffer> {
    try {
      const { certificate, key, mimeType, tsaUrl, reserveSize } = this.opts || {};
      if (!certificate || !key) return content.data;

      const library = await loadSigningLibrary();
      if (!library) return content.data;

      debug('Signing content credentials; timestamp authority: %s', tsaUrl || '(none)');
      const { asset } = await library.signAsset({
        asset: content.data,
        mimeType: content.type,
        intent,
        actions,
        parent: { asset: await this.#getBuffer(), mimeType: mimeType || 'application/octet-stream' },
        output: 'embedded',
        credentials: { certificate, key, tsaUrl, reserveSize }
      });
      debug('Content credentials signed successfully');
      return asset;
    } catch (err) {
      console.warn(
        `Failed to add content credentials; returning original content. (${inspect(err)})`
      );
      return content.data;
    }
  }

  async #getBuffer(): Promise<Buffer> {
    if (!this.#buffer) {
      this.#buffer = await this.#bufferFromStream(this.#stream);
    }
    return this.#buffer;
  }

  async #bufferFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }
}
