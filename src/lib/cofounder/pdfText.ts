import { inflateSync } from "node:zlib";

type PdfObject = {
  id: number;
  dict: string;
  stream?: Uint8Array;
};

const PAGE_LIMIT = 80;

function latin1Decode(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) {
    text += String.fromCharCode(bytes[i] ?? 0);
  }
  return text;
}

function latin1Encode(text: string) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function dictHasType(dict: string, type: string) {
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`/Type\\s*/${escaped}\\b`).test(dict);
}

function dictValue(dict: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = dict.match(new RegExp(`/${escaped}\\s*(\\[(?:[^\\[\\]]|\\[[^\\[\\]]*\\])*\\]|\\d+\\s+\\d+\\s+R|-?\\d+|\\([^)]*\\)|/\\w+)`));
  return match?.[1]?.trim() ?? null;
}

function parseRefs(value: string | null) {
  if (!value) return [];
  return [...value.matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1]));
}

function inflateIfNeeded(dict: string, stream: Uint8Array) {
  if (!/\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode)/.test(dict)) return stream;
  try {
    return new Uint8Array(inflateSync(Buffer.from(stream)));
  } catch {
    return stream;
  }
}

function readLiteralString(source: string, start: number) {
  let i = start + 1;
  let depth = 1;
  let value = "";
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "\\") {
      const next = source[i + 1] ?? "";
      if (next >= "0" && next <= "7") {
        let octal = next;
        i += 2;
        while (octal.length < 3) {
          const digit = source[i];
          if (!digit || digit < "0" || digit > "7") break;
          octal += digit;
          i += 1;
        }
        value += String.fromCharCode(parseInt(octal, 8));
        continue;
      }
      const escapes: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\"
      };
      value += escapes[next] ?? next;
      i += 2;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
    value += ch;
    i += 1;
  }
  return { value, end: i };
}

function readHexString(source: string, start: number) {
  const close = source.indexOf(">", start + 1);
  const end = close === -1 ? source.length : close + 1;
  const hex = source.slice(start + 1, end - 1).replace(/\s+/g, "");
  const padded = hex.length % 2 === 0 ? hex : `${hex}0`;
  let value = "";
  for (let i = 0; i < padded.length; i += 2) {
    value += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return { value, end };
}

function extractTextFromContent(bytes: Uint8Array) {
  const source = latin1Decode(bytes);
  const pieces: string[] = [];

  const takeString = (index: number) => {
    if (source[index] === "(") return readLiteralString(source, index);
    if (source[index] === "<" && source[index + 1] !== "<") return readHexString(source, index);
    return null;
  };

  let i = 0;
  while (i < source.length) {
    if (source.startsWith("TJ", i) || source.startsWith("Tj", i) || source[i] === "'" || source[i] === '"') {
      i += 1;
      continue;
    }
    if (source[i] === "[") {
      const close = source.indexOf("]", i + 1);
      if (close !== -1 && /^\s*TJ/.test(source.slice(close + 1, close + 6))) {
        let cursor = i + 1;
        let combined = "";
        while (cursor < close) {
          const parsed = takeString(cursor);
          if (parsed) {
            combined += parsed.value;
            cursor = parsed.end;
            continue;
          }
          cursor += 1;
        }
        if (combined.trim()) pieces.push(combined);
        i = close + 1;
        continue;
      }
    }
    const parsed = takeString(i);
    if (parsed) {
      const after = source.slice(parsed.end, parsed.end + 8);
      if (/^\s*(Tj|'|")/.test(after)) {
        if (parsed.value.trim() || parsed.value.includes("\n")) pieces.push(parsed.value);
      }
      i = parsed.end;
      continue;
    }
    i += 1;
  }

  return pieces
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseIndirectObjects(raw: string) {
  const objects = new Map<number, PdfObject>();
  const header = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(raw))) {
    const id = Number(match[1]);
    const start = match.index + match[0].length;
    const streamMatch = raw.slice(start).match(/\bstream(?:\r\n|\n|\r)/);
    const streamTokenAt = streamMatch?.index ?? -1;
    const endObjAt = raw.indexOf("endobj", start);
    if (endObjAt === -1) continue;
    if (streamTokenAt === -1 || start + streamTokenAt > endObjAt) {
      objects.set(id, { id, dict: raw.slice(start, endObjAt) });
      header.lastIndex = endObjAt + 6;
      continue;
    }
    const dict = raw.slice(start, start + streamTokenAt);
    const streamStart = start + streamTokenAt + streamMatch![0].length;
    const lengthValue = dictValue(dict, "Length");
    const declaredLength = lengthValue && /^\d+$/.test(lengthValue) ? Number(lengthValue) : null;
    let streamEnd = raw.indexOf("endstream", streamStart);
    if (declaredLength !== null) {
      streamEnd = streamStart + declaredLength;
    } else if (streamEnd === -1) {
      continue;
    }
    const stream = inflateIfNeeded(dict, latin1Encode(raw.slice(streamStart, streamEnd)));
    objects.set(id, { id, dict, stream });
    header.lastIndex = Math.max(endObjAt, streamEnd) + 6;
  }
  return objects;
}

function expandObjectStreams(objects: Map<number, PdfObject>) {
  for (const object of [...objects.values()]) {
    if (!object.stream || !dictHasType(object.dict, "ObjStm")) continue;
    const count = Number(dictValue(object.dict, "N") ?? "0");
    const first = Number(dictValue(object.dict, "First") ?? "0");
    if (!count || Number.isNaN(first)) continue;
    const payload = latin1Decode(object.stream);
    const header = payload.slice(0, first).trim().split(/\s+/);
    for (let i = 0; i < count; i += 1) {
      const id = Number(header[i * 2]);
      const offset = Number(header[i * 2 + 1]);
      const nextOffset = i + 1 < count ? Number(header[(i + 1) * 2 + 1]) : payload.length - first;
      if (!id || Number.isNaN(offset)) continue;
      const body = payload.slice(first + offset, first + nextOffset);
      if (!objects.has(id)) objects.set(id, { id, dict: body });
    }
  }
}

function walkPages(objects: Map<number, PdfObject>, nodeId: number, found: number[]) {
  if (found.length >= PAGE_LIMIT) return;
  const node = objects.get(nodeId);
  if (!node) return;
  if (dictHasType(node.dict, "Page") && !dictHasType(node.dict, "Pages")) {
    found.push(nodeId);
    return;
  }
  for (const child of parseRefs(dictValue(node.dict, "Kids"))) {
    walkPages(objects, child, found);
    if (found.length >= PAGE_LIMIT) return;
  }
}

function pageContent(objects: Map<number, PdfObject>, pageId: number) {
  const page = objects.get(pageId);
  if (!page) return "";
  const contentIds = parseRefs(dictValue(page.dict, "Contents"));
  const streams = contentIds
    .map((id) => objects.get(id)?.stream)
    .filter((stream): stream is Uint8Array => Boolean(stream));
  if (page.stream) streams.unshift(page.stream);
  return streams.map((stream) => extractTextFromContent(stream)).filter(Boolean).join("\n");
}

export function extractPdfPageTexts(bytes: Uint8Array): string[] {
  if (bytes.byteLength < 8 || latin1Decode(bytes.slice(0, 5)) !== "%PDF-") {
    return [];
  }
  const raw = latin1Decode(bytes);
  const objects = parseIndirectObjects(raw);
  expandObjectStreams(objects);
  const catalog = [...objects.values()].find((object) => dictHasType(object.dict, "Catalog"));
  const rootPages = catalog ? parseRefs(dictValue(catalog.dict, "Pages"))[0] : undefined;
  const pageIds: number[] = [];
  if (rootPages) walkPages(objects, rootPages, pageIds);
  if (pageIds.length === 0) {
    for (const object of objects.values()) {
      if (dictHasType(object.dict, "Page") && !dictHasType(object.dict, "Pages")) pageIds.push(object.id);
    }
  }
  const pages = pageIds.slice(0, PAGE_LIMIT).map((id) => pageContent(objects, id));
  if (pages.some((page) => page.trim())) return pages;
  const fallback = [...objects.values()]
    .filter((object) => object.stream && !dictHasType(object.dict, "ObjStm") && !dictHasType(object.dict, "XRef"))
    .map((object) => extractTextFromContent(object.stream!))
    .filter((text) => text.trim());
  return fallback.length > 0 ? fallback : [];
}
