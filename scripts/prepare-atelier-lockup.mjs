import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const source = process.argv[2] ?? "/home/ubuntu/.cursor/projects/workspace/assets/7be19e35-5f88-4830-b0b9-b157430aec0f.png";
const dest = process.argv[3] ?? path.resolve("public/brand/atelier-lockup.png");

const png = PNG.sync.read(fs.readFileSync(source));
const { width, height, data } = png;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma < 10) {
    data[i + 3] = 0;
  } else if (luma < 22) {
    data[i + 3] = Math.round(255 * ((luma - 10) / 12));
  }
}

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (a > 18 && luma >= 40) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 28;
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

const targetW = 480;
const targetH = Math.round(cropH * (targetW / cropW));
const scaled = new PNG({ width: targetW, height: targetH });
for (let y = 0; y < targetH; y += 1) {
  const srcY = Math.min(cropH - 1, Math.round((y * cropH) / targetH));
  for (let x = 0; x < targetW; x += 1) {
    const srcX = Math.min(cropW - 1, Math.round((x * cropW) / targetW));
    const srcStart = (srcY * cropW + srcX) * 4;
    scaled.data.set(cropped.data.subarray(srcStart, srcStart + 4), (y * targetW + x) * 4);
  }
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, PNG.sync.write(scaled));
console.log(JSON.stringify({ dest, cropW, cropH, targetW, targetH, minX, minY, maxX, maxY }));
