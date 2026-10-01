/// <reference types="jest" />
'use strict';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Readable } from 'node:stream';

// C2PASigner is a thin adapter over @nulib/c2pa-signing, which has its own unit
// and integration tests (including against the real c2pa-node addon). These
// cover only what the adapter adds: option mapping, the source-as-parent
// convention, and degrading to unsigned output.

const CERTIFICATE = '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----';
const SOURCE_BUFFER = Buffer.from('original-asset-bytes');
const DATA = Buffer.from('derived-image-bytes');
const SIGNED = Buffer.from('signed-image-bytes');

function makeLibraryMock() {
  return {
    loadC2paNode: jest.fn(async () => ({})),
    signAsset: jest.fn(async (_options: unknown) => ({ asset: SIGNED, manifest: Buffer.from('manifest') }))
  };
}

// Loads a fresh copy of src/c2pa.ts with @nulib/c2pa-signing mocked as given,
// since the module caches its dynamic import in module-level state.
function loadSubject(moduleFactory: () => unknown) {
  jest.resetModules();
  jest.doMock('@nulib/c2pa-signing', moduleFactory, { virtual: true });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/c2pa').C2PASigner;
}

const makeStream = () => Readable.from([SOURCE_BUFFER]);

afterEach(() => {
  jest.restoreAllMocks();
  jest.dontMock('@nulib/c2pa-signing');
  jest.resetModules();
});

describe('C2PASigner', () => {
  it('returns the content unchanged when no certificate/key are configured', async () => {
    const C2PASigner = loadSubject(() => {
      throw new Error('@nulib/c2pa-signing should not be loaded');
    });

    const result = await new C2PASigner(makeStream(), {}).addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', []);

    expect(result).toBe(DATA);
  });

  it.each([
    ['the signing library is missing', () => { throw new Error("Cannot find module '@nulib/c2pa-signing'"); }],
    ['c2pa-node is missing', () => ({ ...makeLibraryMock(), loadC2paNode: async () => { throw new Error('no addon'); } })]
  ])('degrades to unsigned output with a warning when %s', async (_case, factory) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const C2PASigner = loadSubject(factory);

    const result = await new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'k' })
      .addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', []);

    expect(result).toBe(DATA);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('C2PA signing dependencies are not available'));
  });

  describe('when the signing library is available', () => {
    let library: ReturnType<typeof makeLibraryMock>;
    let C2PASigner: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    beforeEach(() => {
      library = makeLibraryMock();
      C2PASigner = loadSubject(() => library);
    });

    it('signs an embedded manifest with the source as parentOf ingredient', async () => {
      const actions = [{ action: 'c2pa.edited' }];
      const signer = new C2PASigner(makeStream(), {
        certificate: CERTIFICATE,
        key: 'k',
        mimeType: 'image/tiff',
        tsaUrl: 'https://timestamp.example.com',
        reserveSize: 5_000
      });

      const result = await signer.addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', actions);

      expect(result).toBe(SIGNED);
      expect(library.signAsset).toHaveBeenCalledWith({
        asset: DATA,
        mimeType: 'image/jpeg',
        intent: 'edit',
        actions,
        parent: { asset: SOURCE_BUFFER, mimeType: 'image/tiff' },
        output: 'embedded',
        credentials: { certificate: CERTIFICATE, key: 'k', tsaUrl: 'https://timestamp.example.com', reserveSize: 5_000 }
      });
    });

    it('treats a source of unknown type as application/octet-stream', async () => {
      await new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'k' })
        .addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', []);

      const [options] = library.signAsset.mock.calls[0] as [{ parent: { mimeType: string } }];
      expect(options.parent.mimeType).toBe('application/octet-stream');
    });

    it('reads the source stream only once across multiple derivatives', async () => {
      const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'k' });

      await signer.addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', []);
      await signer.addContentCredentials({ data: DATA, type: 'image/png' }, 'edit', []);

      const parents = library.signAsset.mock.calls.map(([options]) => (options as { parent: { asset: Buffer } }).parent.asset);
      expect(parents).toEqual([SOURCE_BUFFER, SOURCE_BUFFER]);
    });

    it('returns the original content with a warning when signing fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      library.signAsset.mockRejectedValue(new Error('TSA offline'));

      const result = await new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'k' })
        .addContentCredentials({ data: DATA, type: 'image/jpeg' }, 'edit', []);

      expect(result).toBe(DATA);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('TSA offline'));
    });
  });
});
