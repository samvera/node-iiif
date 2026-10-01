/**
 * Signing material for the C2PA integration test.
 *
 * The public sample ES256 credentials from c2pa-rs -- a well-known test cert
 * with no trust anchor, published for exactly this purpose (so signatures
 * validate structurally while reporting signingCredential.untrusted). Fetched on
 * first use and cached under tests/.fixture-cache, which is gitignored, so only
 * the first run needs network access.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE =
  'https://raw.githubusercontent.com/contentauth/c2pa-rs/refs/heads/main/cli/sample';
const CACHE_DIR = path.resolve(import.meta.dirname, '..', '.fixture-cache');
const CERT_FILE = 'es256_certs.pem';
const KEY_FILE = 'es256_private.key';

export type SigningPair = { certificate: string; key: string };

async function fetchOrCache(filename: string): Promise<string> {
  const cached = path.join(CACHE_DIR, filename);
  try {
    return await readFile(cached, 'utf8');
  } catch {
    // not cached yet
  }

  const url = `${BASE}/${filename}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  }
  const body = await response.text();
  if (!body.includes('-----BEGIN')) {
    throw new Error(`${url} did not return PEM content`);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cached, body, 'utf8');
  return body;
}

export async function loadFixtureSigningPair(): Promise<SigningPair> {
  try {
    const [certificate, key] = await Promise.all([
      fetchOrCache(CERT_FILE),
      fetchOrCache(KEY_FILE)
    ]);
    return { certificate, key };
  } catch (err) {
    throw new Error(
      `Could not obtain the c2pa-rs sample signing credentials ` +
        `(${(err as Error).message}). The first run needs network access; ` +
        `they are cached in tests/.fixture-cache afterwards.`
    );
  }
}
