/**
 * Integration test: C2PASigner against the real @contentauth/c2pa-node addon.
 *
 * The unit tests in tests/c2pa.test.ts mock the addon, so they can only assert
 * which builder methods get called. This pins down the property that actually
 * matters and that mocks cannot show: a derivative inherits the *whole*
 * provenance chain of its source and points at its immediate parent, rather
 * than silently skipping a generation.
 *
 * Run with `npm run test:integration`. Kept out of the jest suite because the
 * addon is ESM-only and optional, while jest here runs CommonJS via ts-jest.
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { C2PASigner } from '../../src/c2pa.ts';
import { loadFixtureSigningPair, type SigningPair } from './fixtureCert.mts';

type C2paNodeModule = typeof import('@contentauth/c2pa-node');

const JPEG = 'image/jpeg';
const CREATED = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture';

const image = (width: number, height: number, background: Record<string, number>) =>
  sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();

describe('C2PASigner provenance chain', () => {
  let c2pa: C2paNodeModule;
  let pair: SigningPair;

  before(async () => {
    c2pa = await import('@contentauth/c2pa-node');
    pair = await loadFixtureSigningPair();
  });

  /** Signs `asset` with an embedded manifest, optionally chaining to `parent`. */
  async function signGeneration(asset: Buffer, label: string, parent?: Buffer) {
    const builder = c2pa.Builder.new();
    if (parent) {
      builder.setIntent('edit');
      await builder.addIngredient(
        JSON.stringify({ title: `${label}-parent.jpg`, format: JPEG, relationship: 'parentOf' }),
        { buffer: parent, mimeType: JPEG }
      );
      builder.addAssertion(
        'c2pa.actions',
        { actions: [{ action: 'c2pa.transcoded', softwareAgent: label }] },
        'Cbor'
      );
    } else {
      builder.setIntent({ create: CREATED });
      builder.addAssertion(
        'c2pa.actions',
        { actions: [{ action: 'c2pa.created', digitalSourceType: CREATED, softwareAgent: label }] },
        'Cbor'
      );
    }

    const signer = c2pa.LocalSigner.newSigner(
      Buffer.from(pair.certificate),
      Buffer.from(pair.key),
      'es256'
    );
    const output: { buffer: Buffer | null } = { buffer: null };
    builder.sign(signer, { buffer: asset, mimeType: JPEG }, output);
    assert.ok(output.buffer, `failed to sign ${label}`);
    return output.buffer;
  }

  /** Runs a source through C2PASigner the way the IIIF server does. */
  async function deriveViaSigner(source: Buffer, size: number) {
    const signer = new C2PASigner(Readable.from([source]), {
      certificate: pair.certificate,
      key: pair.key,
      mimeType: JPEG
    });
    return signer.addContentCredentials(
      { data: await image(size, size, { r: 90, g: 120, b: 10 }), type: JPEG },
      'edit',
      [{ action: 'c2pa.transcoded', softwareAgent: 'node-iiif' }]
    );
  }

  async function storeOf(buffer: Buffer) {
    const reader = await c2pa.Reader.fromAsset({ buffer, mimeType: JPEG });
    assert.ok(reader, 'derivative has no manifest');
    return reader.json();
  }

  async function labelOf(buffer: Buffer) {
    const reader = await c2pa.Reader.fromAsset({ buffer, mimeType: JPEG });
    assert.ok(reader, 'asset has no manifest');
    const label = reader.activeLabel();
    assert.ok(label, 'asset has no active manifest label');
    return label;
  }

  it('inherits the full chain from an already-derived source', async () => {
    // gen1 -> gen2, so the source handed to C2PASigner already has an ingredient.
    const gen1 = await signGeneration(await image(600, 400, { r: 10, g: 120, b: 90 }), 'gen1');
    const gen2 = await signGeneration(await image(300, 200, { r: 120, g: 10, b: 90 }), 'gen2', gen1);
    const gen1Label = await labelOf(gen1);
    const gen2Label = await labelOf(gen2);

    const store = await storeOf(await deriveViaSigner(gen2, 150));

    // Every generation present, not just the source and the derivative.
    assert.equal(Object.keys(store.manifests).length, 3, 'all three generations must be in the store');

    const ingredients = store.manifests[store.active_manifest!]!.ingredients!;
    assert.equal(ingredients.length, 1);
    assert.equal(ingredients[0].relationship, 'parentOf');

    // The immediate parent, NOT the grandparent. addIngredientFromReader() would
    // hoist gen1 here and silently drop gen2.
    assert.equal(ingredients[0].active_manifest, gen2Label, 'must chain to gen2, not skip to gen1');

    // And the chain stays walkable one more hop inside the derivative's store.
    assert.equal(
      store.manifests[gen2Label]!.ingredients![0].active_manifest,
      gen1Label,
      "gen2's own ingredient must still resolve to gen1"
    );

    assert.equal(store.validation_state, 'Valid');
  });

  it('carries provenance from a source that is itself an original', async () => {
    const gen1 = await signGeneration(await image(400, 300, { r: 30, g: 60, b: 120 }), 'solo');
    const gen1Label = await labelOf(gen1);

    const store = await storeOf(await deriveViaSigner(gen1, 200));

    assert.equal(Object.keys(store.manifests).length, 2);
    assert.equal(
      store.manifests[store.active_manifest!]!.ingredients![0].active_manifest,
      gen1Label
    );
    assert.equal(store.validation_state, 'Valid');
  });

  it('signs a derivative of an unsigned source without claiming provenance', async () => {
    const store = await storeOf(
      await deriveViaSigner(await image(320, 240, { r: 70, g: 70, b: 70 }), 160)
    );

    assert.equal(Object.keys(store.manifests).length, 1, 'nothing to inherit');
    const ingredient = store.manifests[store.active_manifest!]!.ingredients![0];
    assert.equal(ingredient.relationship, 'parentOf');
    assert.equal(ingredient.active_manifest, undefined, 'no provenance invented');
    assert.equal(ingredient.validation_results, undefined);
  });
});
