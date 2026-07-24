import type { Action, BuilderIntent } from "@contentauth/c2pa-types";
import { sign as signRaw } from "node:crypto";

type C2paNodeModule = typeof import("@contentauth/c2pa-node");
type ReaderInstance = InstanceType<C2paNodeModule["Reader"]>;

let c2paNodeModule: Promise<C2paNodeModule | null> | undefined;

// @contentauth/c2pa-node is an optional dependency (it bundles a native addon).
// Consumers who don't need content credentials shouldn't have to install it, so
// it's loaded lazily and failures here just disable signing.
function loadC2paNode(): Promise<C2paNodeModule | null> {
  if (!c2paNodeModule) {
    c2paNodeModule = import("@contentauth/c2pa-node").catch((err) => {
      console.warn(
        `@contentauth/c2pa-node is not available; content credentials will not be added. (${err.message})`
      );
      return null;
    });
  }
  return c2paNodeModule;
}

export type C2PASignerOptions = {
  certificate: string;
  key: string;
  mimeType?: string;
  tsaUrl?: string;
  reserveSize?: number;
};

export class C2PASigner {
  #buffer: Buffer;
  #stream: NodeJS.ReadableStream;
  opts: C2PASignerOptions;

  constructor(stream: NodeJS.ReadableStream, opts: C2PASignerOptions) {
    this.#stream = stream;
    this.opts = opts;
  }

  async addContentCredentials(content: { data: Buffer, type: string }, intent: BuilderIntent, actions: Action[] = []): Promise<Buffer> {
    const { certificate: cert, key, mimeType, tsaUrl, reserveSize = 20_000 } = this.opts || {};
    if (!cert || !key) return content.data;

    const c2pa = await loadC2paNode();
    if (!c2pa) return content.data;
    const { Builder, CallbackSigner, Reader } = c2pa;

    const builder = Builder.new();
    builder.setIntent(intent);
    const { reader, buffer } = await this.#getActiveReader(Reader);

    try {
      builder.addIngredientFromReader(reader);
    } catch (err) {
      if (!reader || err.message.includes('ingredient file not found')) {
        console.warn(
          `addIngredientFromReader failed; adding ingredient from buffer instead`
        );
        const manifest = reader?.getActive();

        const ingredientContent = {
          title: manifest?.title,
          format: manifest?.format || mimeType,
          instance_id: manifest?.instance_id,
          relationship: 'parentOf'
        };

        await builder.addIngredient(JSON.stringify(ingredientContent), {
          buffer,
          mimeType
        });
      } else {
        throw err;
      }
    }

    builder.addAssertion(
      'c2pa.actions',
      {
        actions: actions || []
      },
      'Cbor'
    );

    const signer = CallbackSigner.newSigner(
      {
        alg: 'es256',
        certs: [Buffer.from(cert)],
        reserveSize,
        tsaUrl,
        directCoseHandling: false
      },
      async (data: Buffer) => signRaw('sha256', data, { key, dsaEncoding: 'ieee-p1363' })
    );

    const output = { buffer: null };
    await builder.signAsync(signer, { buffer: content.data, mimeType: content.type }, output);
    return output.buffer;
  };

  async #getActiveReader(Reader: C2paNodeModule["Reader"]): Promise<{ reader: ReaderInstance; buffer: Buffer }> {
    const buffer = await this.#getBuffer();
    const reader = await Reader.fromAsset({
      buffer,
      mimeType: this.opts.mimeType || 'application/octet-stream'
    });
    return { reader, buffer };
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