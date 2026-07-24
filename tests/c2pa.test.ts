/// <reference types="jest" />
'use strict';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';

const CERTIFICATE = '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----';
const SOURCE_BUFFER = Buffer.from('original-asset-bytes');

function makeStream() {
  return Readable.from([SOURCE_BUFFER]);
}

function makeBuilderMock() {
  return {
    setIntent: jest.fn(),
    addIngredientFromReader: jest.fn(),
    addIngredient: jest.fn(async () => undefined),
    addAssertion: jest.fn(),
    signAsync: jest.fn(async (_signer: unknown, _input: unknown, output: { buffer: Buffer | null }) => {
      output.buffer = Buffer.from('signed-bytes');
      return output.buffer;
    })
  };
}

function makeC2paNodeMock(builderMock: ReturnType<typeof makeBuilderMock>, readerResult: unknown = null) {
  return {
    Builder: { new: jest.fn(() => builderMock) },
    Reader: { fromAsset: jest.fn(async () => readerResult) },
    CallbackSigner: {
      newSigner: jest.fn((config: unknown, callback: unknown) => ({ config, callback, __mockSigner: true }))
    }
  };
}

// Loads a fresh copy of src/c2pa.ts with @contentauth/c2pa-node mocked as given,
// since the module caches its dynamic import in module-level state.
function loadSubject(moduleFactory: () => unknown) {
  jest.resetModules();
  jest.doMock('@contentauth/c2pa-node', moduleFactory, { virtual: true });
  const { C2PASigner } = require('../src/c2pa');
  return C2PASigner;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.dontMock('@contentauth/c2pa-node');
  jest.resetModules();
});

describe('C2PASigner', () => {
  it('returns the content unchanged when no certificate/key are configured', async () => {
    const C2PASigner = loadSubject(() => {
      throw new Error('@contentauth/c2pa-node should not be loaded');
    });
    const signer = new C2PASigner(makeStream(), {});
    const data = Buffer.from('output-bytes');

    const result = await signer.addContentCredentials({ data, type: 'image/jpeg' }, 'edit', []);

    expect(result).toBe(data);
  });

  it('degrades gracefully when @contentauth/c2pa-node cannot be loaded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const C2PASigner = loadSubject(() => {
      throw new Error("Cannot find module '@contentauth/c2pa-node'");
    });
    const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'fake-key' });
    const data = Buffer.from('output-bytes');

    const result = await signer.addContentCredentials({ data, type: 'image/jpeg' }, 'edit', []);

    expect(result).toBe(data);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@contentauth/c2pa-node is not available'));
    warn.mockRestore();
  });

  describe('when @contentauth/c2pa-node is available', () => {
    let builderMock: ReturnType<typeof makeBuilderMock>;
    let readerMock: { getActive: jest.Mock };
    let c2paNodeMock: ReturnType<typeof makeC2paNodeMock>;
    let C2PASigner: any;

    beforeEach(() => {
      readerMock = { getActive: jest.fn(() => undefined) };
      builderMock = makeBuilderMock();
      c2paNodeMock = makeC2paNodeMock(builderMock, readerMock);
      C2PASigner = loadSubject(() => c2paNodeMock);
    });

    it('builds and signs a manifest', async () => {
      const actions = [{ action: 'c2pa.edited' }];
      const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'fake-key' });
      const data = Buffer.from('output-bytes');

      const result = await signer.addContentCredentials({ data, type: 'image/jpeg' }, 'edit', actions);

      expect(c2paNodeMock.Builder.new).toHaveBeenCalled();
      expect(builderMock.setIntent).toHaveBeenCalledWith('edit');
      expect(c2paNodeMock.Reader.fromAsset).toHaveBeenCalledWith({
        buffer: SOURCE_BUFFER,
        mimeType: 'application/octet-stream'
      });
      expect(builderMock.addIngredientFromReader).toHaveBeenCalledWith(readerMock);
      expect(builderMock.addIngredient).not.toHaveBeenCalled();
      expect(builderMock.addAssertion).toHaveBeenCalledWith('c2pa.actions', { actions }, 'Cbor');

      expect(c2paNodeMock.CallbackSigner.newSigner).toHaveBeenCalledTimes(1);
      const [config] = c2paNodeMock.CallbackSigner.newSigner.mock.calls[0] as [any, any];
      expect(config).toMatchObject({
        alg: 'es256',
        reserveSize: 20_000,
        tsaUrl: undefined,
        directCoseHandling: false
      });
      expect(config.certs).toEqual([Buffer.from(CERTIFICATE)]);

      expect(builderMock.signAsync).toHaveBeenCalledTimes(1);
      const [signerArg, input, output] = builderMock.signAsync.mock.calls[0] as [any, any, any];
      expect(signerArg.__mockSigner).toBe(true);
      expect(input).toEqual({ buffer: data, mimeType: 'image/jpeg' });
      expect(result).toEqual(output.buffer);
    });

    it('passes a custom reserveSize and tsaUrl through to the signer config', async () => {
      const signer = new C2PASigner(makeStream(), {
        certificate: CERTIFICATE,
        key: 'fake-key',
        reserveSize: 5_000,
        tsaUrl: 'https://timestamp.example.com'
      });

      await signer.addContentCredentials({ data: Buffer.from('x'), type: 'image/jpeg' }, 'edit', []);

      const [config] = c2paNodeMock.CallbackSigner.newSigner.mock.calls[0] as [any, any];
      expect(config.reserveSize).toBe(5_000);
      expect(config.tsaUrl).toBe('https://timestamp.example.com');
    });

    it('produces a raw ES256 signature via the signer callback', async () => {
      const { privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: privateKey });
      await signer.addContentCredentials({ data: Buffer.from('x'), type: 'image/jpeg' }, 'edit', []);

      const [, callback] = c2paNodeMock.CallbackSigner.newSigner.mock.calls[0] as [any, any];
      const signature = await callback(Buffer.from('data-to-sign'));

      expect(Buffer.isBuffer(signature)).toBe(true);
      // Raw (non-DER) r || s encoding for a P-256 ES256 signature is always 64 bytes.
      expect(signature.length).toBe(64);
    });

    it('falls back to building an ingredient from the buffer when the ingredient is not found', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      builderMock.addIngredientFromReader.mockImplementation(() => {
        throw new Error('ingredient file not found');
      });
      readerMock.getActive.mockReturnValue({
        title: 'Original',
        format: 'image/tiff',
        instance_id: 'abc-123'
      });

      const signer = new C2PASigner(makeStream(), {
        certificate: CERTIFICATE,
        key: 'fake-key',
        mimeType: 'image/tiff'
      });
      await signer.addContentCredentials({ data: Buffer.from('x'), type: 'image/jpeg' }, 'edit', []);

      expect(builderMock.addIngredient).toHaveBeenCalledWith(
        JSON.stringify({
          title: 'Original',
          format: 'image/tiff',
          instance_id: 'abc-123',
          relationship: 'parentOf'
        }),
        { buffer: SOURCE_BUFFER, mimeType: 'image/tiff' }
      );
    });

    it('falls back to building an ingredient from the buffer when there is no active reader', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      c2paNodeMock.Reader.fromAsset.mockResolvedValue(null);
      builderMock.addIngredientFromReader.mockImplementation(() => {
        throw new Error('some other native error');
      });

      const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'fake-key' });
      await signer.addContentCredentials({ data: Buffer.from('x'), type: 'image/jpeg' }, 'edit', []);

      expect(builderMock.addIngredient).toHaveBeenCalled();
    });

    it('re-throws unexpected errors from addIngredientFromReader', async () => {
      builderMock.addIngredientFromReader.mockImplementation(() => {
        throw new Error('boom');
      });

      const signer = new C2PASigner(makeStream(), { certificate: CERTIFICATE, key: 'fake-key' });

      await expect(
        signer.addContentCredentials({ data: Buffer.from('x'), type: 'image/jpeg' }, 'edit', [])
      ).rejects.toThrow('boom');
    });
  });
});
