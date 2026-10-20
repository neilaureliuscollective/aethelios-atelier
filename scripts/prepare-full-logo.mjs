import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const source =
  process.argv[2] ??
  "/home/ubuntu/.cursor/projects/workspace/assets/ff5bc8e3-a284-462c-ae93-76c7d0a6dfa8.png";
const root = process.cwd();

function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function knockoutBlack(png) {
  const { data } = png;
  for (let i = 0; i < data.length; i += 4) {
    const luma = lumaOf(data[i], data[i + 1], data[i + 2]);
    if (luma < 8) {
      data[i + 3] = 0;
    } else if (luma < 32) {
      data[i + 3] = Math.round(255 * ((luma - 8) / 24));
    }
  }
  return png;
}

function cropToContent(png, pad = 36) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const luma = lumaOf(data[i], data[i + 1], data[i + 2]);
      if (a > 16 && luma >= 28) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y += 1) {
    const srcStart = ((minY + y) * width + minX) * 4;
    cropped.data.set(data.subarray(srcStart, srcStart + cropW * 4), y * cropW * 4);
  }
  return { png: cropped, minX, minY, maxX, maxY, cropW, cropH };
}

function sample(png, x, y) {
  const ix = Math.min(png.width - 1, Math.max(0, x));
  const iy = Math.min(png.height - 1, Math.max(0, y));
  const x0 = Math.floor(ix);
  const y0 = Math.floor(iy);
  const x1 = Math.min(png.width - 1, x0 + 1);
  const y1 = Math.min(png.height - 1, y0 + 1);
  const fx = ix - x0;
  const fy = iy - y0;
  const out = new Uint8Array(4);
  for (let c = 0; c < 4; c += 1) {
    const p00 = png.data[(y0 * png.width + x0) * 4 + c];
    const p10 = png.data[(y0 * png.width + x1) * 4 + c];
    const p01 = png.data[(y1 * png.width + x0) * 4 + c];
    const p11 = png.data[(y1 * png.width + x1) * 4 + c];
    out[c] = Math.round(p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy);
  }
  return out;
}

function scaleTo(png, targetW, targetH) {
  const scaled = new PNG({ width: targetW, height: targetH });
  for (let y = 0; y < targetH; y += 1) {
    const srcY = ((y + 0.5) * png.height) / targetH - 0.5;
    for (let x = 0; x < targetW; x += 1) {
      const srcX = ((x + 0.5) * png.width) / targetW - 0.5;
      scaled.data.set(sample(png, srcX, srcY), (y * targetW + x) * 4);
    }
  }
  return scaled;
}

function containInSquare(png, size) {
  const square = new PNG({ width: size, height: size });
  square.data.fill(0);
  const scale = Math.min(size / png.width, size / png.height);
  const drawW = Math.max(1, Math.round(png.width * scale));
  const drawH = Math.max(1, Math.round(png.height * scale));
  const fitted = scaleTo(png, drawW, drawH);
  const ox = Math.floor((size - drawW) / 2);
  const oy = Math.floor((size - drawH) / 2);
  for (let y = 0; y < drawH; y += 1) {
    const destStart = ((oy + y) * size + ox) * 4;
    square.data.set(fitted.data.subarray(y * drawW * 4, (y + 1) * drawW * 4), destStart);
  }
  return square;
}

function writePng(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function writeWebp(pngPath, webpPath) {
  execFileSync(
    "ffmpeg",
    ["-y", "-i", pngPath, "-c:v", "libwebp", "-quality", "92", "-compression_level", "4", webpPath],
    { stdio: "pipe" }
  );
}

const raw = fs.readFileSync(source);
const originalDest = path.join(root, "public/brand/original/logo.png");
fs.mkdirSync(path.dirname(originalDest), { recursive: true });
fs.writeFileSync(originalDest, raw);

const knocked = knockoutBlack(PNG.sync.read(raw));
const cropped = cropToContent(knocked);
const lockupW = 480;
const lockupH = Math.round(cropped.cropH * (lockupW / cropped.cropW));
const lockup = scaleTo(cropped.png, lockupW, lockupH);

const logoPng = path.join(root, "public/brand/logo.png");
const lockupPng = path.join(root, "public/brand/atelier-lockup.png");
writePng(logoPng, cropped.png);
writePng(lockupPng, lockup);
writePng(path.join(root, "public/brand/logo-1024.png"), containInSquare(cropped.png, 1024));
writePng(path.join(root, "public/brand/logo-512.png"), containInSquare(cropped.png, 512));
writePng(path.join(root, "public/brand/logo-256.png"), containInSquare(cropped.png, 256));
writePng(path.join(root, "public/brand/logo-128.png"), containInSquare(cropped.png, 128));
writePng(path.join(root, "public/discovery/brand/logo.png"), containInSquare(cropped.png, 512));
writePng(path.join(root, "public/discovery/brand/logo-256.png"), containInSquare(cropped.png, 256));

writeWebp(logoPng, path.join(root, "public/brand/logo.webp"));
writeWebp(path.join(root, "public/discovery/brand/logo.png"), path.join(root, "public/discovery/brand/logo.webp"));

const report = {
  source,
  original: originalDest,
  crop: {
    minX: cropped.minX,
    minY: cropped.minY,
    maxX: cropped.maxX,
    maxY: cropped.maxY,
    cropW: cropped.cropW,
    cropH: cropped.cropH
  },
  logo: { width: cropped.cropW, height: cropped.cropH },
  lockup: { width: lockupW, height: lockupH, aspect: Number((lockupW / lockupH).toFixed(6)) }
};
console.log(JSON.stringify(report, null, 2));
