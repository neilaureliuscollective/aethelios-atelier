import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { deflateSync } from "node:zlib";
import { crc32 } from "node:zlib";

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type InspectedImage = {
  mime: "image/png";
  width: number;
  height: number;
  byteLength: number;
  hash?: string;
};

export const EXPORT_PNG_MAX_BYTES = 8_000_000;

export function inspectPng(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength < 33) {
    throw new Error("The composed image is empty or truncated. The draft was not marked exported.");
  }
  if (bytes.byteLength > EXPORT_PNG_MAX_BYTES) {
    throw new Error("The composed image exceeds the 8 MB export limit. The draft was not marked exported.");
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]!) {
      throw new Error("Export requires a PNG file. The supplied bytes are not a PNG. The draft was not marked exported.");
    }
  }
  const typeBytes = [bytes[12], bytes[13], bytes[14], bytes[15]];
  if (typeBytes.some((value) => value == null)) {
    throw new Error("The PNG header is truncated. The draft was not marked exported.");
  }
  const type = String.fromCharCode(...(typeBytes as [number, number, number, number]));
  if (type !== "IHDR") {
    throw new Error("The PNG header is malformed. The draft was not marked exported.");
  }
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new Error("The PNG dimensions are outside the allowed export range. The draft was not marked exported.");
  }
  return { mime: "image/png", width, height, byteLength: bytes.byteLength };
}

export function hashPng(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/** Max absolute per-channel difference allowed when comparing preview and export rasters. */
export const RASTER_TOLERANCE = 2;

export function maxChannelDelta(left: Uint8Array | number[], right: Uint8Array | number[]) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < left.length; i += 1) {
    const delta = Math.abs((left[i] ?? 0) - (right[i] ?? 0));
    if (delta > max) max = delta;
  }
  return max;
}

export function decodePng(bytes: Uint8Array) {
  try {
    const png = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
    if (!png.data?.byteLength) {
      throw new Error("empty");
    }
    return { width: png.width, height: png.height, data: png.data };
  } catch {
    throw new Error("The composed image could not be decoded. The draft was not marked exported.");
  }
}

export function assertExportMatchesRevision(
  bytes: Uint8Array,
  expected: { width: number; height: number }
): InspectedImage {
  const inspected = inspectPng(bytes);
  const decoded = decodePng(bytes);
  if (decoded.width !== expected.width || decoded.height !== expected.height) {
    throw new Error(
      `Export dimensions ${decoded.width}×${decoded.height} do not match the saved composition ${expected.width}×${expected.height}. The draft was not marked exported.`
    );
  }
  if (inspected.width !== decoded.width || inspected.height !== decoded.height) {
    throw new Error("The PNG header and decoded pixels do not agree. The draft was not marked exported.");
  }
  return { ...inspected, hash: hashPng(bytes) };
}

export function encodeSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number] = [42, 34, 24, 255]
): Uint8Array {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 4;
      raw[i] = rgba[0];
      raw[i + 1] = rgba[1];
      raw[i + 2] = rgba[2];
      raw[i + 3] = rgba[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ];
  return Uint8Array.from(Buffer.concat(chunks));
}

function readUint32(bytes: Uint8Array, offset: number) {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a == null || b == null || c == null || d == null) {
    throw new Error("The PNG header is truncated. The draft was not marked exported.");
  }
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}
