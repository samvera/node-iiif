import { Readable } from 'stream';

export interface TileSize {
  width: number | undefined | null;
  height: number | undefined | null;
}

type ImageFormat = 'tiff-le' | 'tiff-be' | 'jp2' | 'unknown';

const CHUNK_SIZE = 5 * 1024; // 5KB

/**
 * Wraps a Readable stream in an async interface that accumulates chunks
 * on demand. Call `ensure(n)` to buffer at least `n` bytes, then read
 * from `buf` directly.
 */
class StreamBuffer {
  private chunks: Buffer[] = [];
  private _length = 0;
  private done = false;
  private iterator: AsyncIterableIterator<Buffer>;

  constructor(stream: Readable) {
    stream.pause();
    this.iterator = stream[
      Symbol.asyncIterator
    ]() as AsyncIterableIterator<Buffer>;
  }

  get length() {
    return this._length;
  }

  get buf(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /** Buffer at least `needed` bytes, or until stream is exhausted. */
  async ensure(needed: number): Promise<void> {
    while (this._length < needed && !this.done) {
      const { value, done } = await this.iterator.next();
      if (done) {
        this.done = true;
      } else {
        this.chunks.push(value);
        this._length += value.length;
      }
    }
  }

  /** Read `count` bytes starting at `offset`, fetching more chunks if needed. */
  async read(offset: number, count: number): Promise<Buffer> {
    await this.ensure(offset + count);
    return this.buf.subarray(offset, offset + count);
  }
}

const magicNumbers = [
  { type: 'tiff-le', magic: Buffer.from([0x49, 0x49, 0x2a, 0x00]) },
  { type: 'tiff-be', magic: Buffer.from([0x4d, 0x4d, 0x00, 0x2a]) },
  { type: 'jp2', magic: Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50]) },
  { type: 'jp2', magic: Buffer.from([0xff, 0x4f]) }
];

function detectFormat(buf: Buffer): ImageFormat {
  if (buf.length < 8) return 'unknown';
  for (const { type, magic } of magicNumbers) {
    if (buf.subarray(0, magic.length).equals(magic)) return type as ImageFormat;
  }
  return 'unknown';
}

async function getTiffTileSize(
  sb: StreamBuffer,
  littleEndian: boolean
): Promise<TileSize> {
  const readUInt16 = (buf: Buffer, offset: number) =>
    littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
  const readUInt32 = (buf: Buffer, offset: number) =>
    littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);

  // Bytes 4-7 contain the IFD offset
  const header = await sb.read(0, 8);
  const ifdOffset = readUInt32(header, 4);

  // First 2 bytes of the IFD are the entry count
  const ifdHeader = await sb.read(ifdOffset, 2);
  const entryCount = readUInt16(ifdHeader, 0);

  // Each IFD entry is 12 bytes
  const ifdData = await sb.read(ifdOffset + 2, entryCount * 12);

  let width: number | undefined | null;
  let height: number | undefined | null;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = i * 12;
    const tag = readUInt16(ifdData, entryOffset);
    const value = readUInt32(ifdData, entryOffset + 8);

    if (tag === 322) width = value; // TileWidth
    if (tag === 323) height = value; // TileLength

    if (width !== undefined && height !== undefined) break;
  }

  return { width, height };
}

async function getJP2TileSize(sb: StreamBuffer): Promise<TileSize> {
  const magic = await sb.read(0, 2);
  const isRawCodestream = magic[0] === 0xff && magic[1] === 0x4f;

  let offset = 0;

  if (!isRawCodestream) {
    // Walk JP2 boxes to find the jp2c (codestream) box
    let foundCodestream = false;
    while (true) {
      const boxHeader = await sb.read(offset, 8);
      if (boxHeader.length < 8) break;

      const boxLength = boxHeader.readUInt32BE(0);
      const boxType = boxHeader.readUInt32BE(4);

      if (boxType === 0x6a703263) {
        // 'jp2c'
        offset += 8; // skip box header, now pointing at codestream
        foundCodestream = true;
        break;
      }

      if (boxLength < 8) break; // malformed
      offset += boxLength;
    }

    if (!foundCodestream) return { width: null, height: null };
  }

  // Scan for SIZ marker (FF51), reading in chunks to avoid buffering the whole file
  while (true) {
    const chunk = await sb.read(offset, CHUNK_SIZE);
    if (chunk.length < 2) break;

    for (let i = 0; i < chunk.length - 1; i++) {
      if (chunk[i] === 0xff && chunk[i + 1] === 0x51) {
        // SIZ layout from marker start:
        //   FF51 (2) + segment length (2) + Rsiz (2) + Xsiz (4) + Ysiz (4)
        //   + XOsiz (4) + YOsiz (4) = 22 bytes before XTsiz
        const sizData = await sb.read(offset + i + 22, 8);
        if (sizData.length < 8) return { width: null, height: null };
        return {
          width: sizData.readUInt32BE(0), // XTsiz
          height: sizData.readUInt32BE(4) // YTsiz
        };
      }
    }

    if (chunk.length < CHUNK_SIZE) break; // end of stream
    offset += CHUNK_SIZE - 1; // overlap by 1 to avoid missing a marker at a chunk boundary
  }

  return { width: null, height: null };
}

export async function getTileSize(stream: Readable): Promise<TileSize> {
  const sb = new StreamBuffer(stream);

  // Read just enough to detect the format
  await sb.ensure(8);
  const format = detectFormat(sb.buf);

  if (format === 'tiff-le' || format === 'tiff-be') {
    return getTiffTileSize(sb, format === 'tiff-le');
  }

  if (format === 'jp2') {
    return getJP2TileSize(sb);
  }

  return { width: null, height: null };
}
