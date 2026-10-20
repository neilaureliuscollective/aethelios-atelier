import { compositionCssFont, coverCropRect, wrapLines, type CompositionBox, type CompositionSpec } from "./composition";

/** One rasterizer for the visible preview and downloaded PNG. Never redraw text in a provider. */
export async function renderComposition(spec: CompositionSpec, canvas: HTMLCanvasElement) {
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not compose the export canvas.");
  if (document.fonts?.ready) await document.fonts.ready;
  ctx.fillStyle = spec.palette.canvas;
  ctx.fillRect(0, 0, spec.width, spec.height);
  if (spec.backgroundImageUrl) {
    const image = await loadCompositionImage(spec.backgroundImageUrl);
    const frame = spec.imageFrame ?? { x: 0, y: 0, width: 100, height: 100 };
    const x = frame.x * spec.width / 100;
    const y = frame.y * spec.height / 100;
    const width = frame.width * spec.width / 100;
    const height = frame.height * spec.height / 100;
    const crop = coverCropRect(image.naturalWidth || image.width, image.naturalHeight || image.height,
      width, height, spec.crop.x, spec.crop.y, spec.crop.zoom);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(image, x + crop.x, y + crop.y, crop.width, crop.height);
    ctx.restore();
  }
  if (spec.accentRule) {
    const rule = spec.accentRule;
    ctx.fillStyle = spec.palette.accent;
    ctx.fillRect(rule.x * spec.width / 100, rule.y * spec.height / 100,
      rule.width * spec.width / 100, rule.height * spec.height / 100);
  }
  drawText(ctx, spec.headline, spec);
  drawText(ctx, spec.body, spec);
  if (spec.board) {
    const width = spec.width;
    const height = spec.height;
    const legacy = spec.layoutVersion !== 2;
    spec.board.swatches.forEach((color, index) => {
      const x = (legacy ? 0.08 + index * 0.135 : 0.06 + index * 0.225) * width;
      const y = height * (legacy ? 0.72 : 0.68);
      const swatchWidth = width * (legacy ? 0.11 : 0.205);
      const swatchHeight = height * (legacy ? 0.08 : 0.11);
      // Outline makes the canvas-color swatch visible against its identical background.
      const border = legacy ? 0 : 2;
      if (border) {
        ctx.fillStyle = spec.palette.muted;
        ctx.fillRect(x, y, swatchWidth, swatchHeight);
      }
      ctx.fillStyle = color;
      ctx.fillRect(x + border, y + border, swatchWidth - border * 2, swatchHeight - border * 2);
      ctx.fillStyle = spec.palette.ink;
      ctx.font = `400 ${legacy ? 20 : Math.round(width * 0.026)}px Arial, sans-serif`;
      ctx.fillText(color.toUpperCase(), x, height * (legacy ? 0.81 : 0.80));
    });
    ctx.fillStyle = spec.palette.ink;
    ctx.font = `400 ${legacy ? 22 : Math.round(width * 0.028)}px Arial, sans-serif`;
    ctx.fillText(spec.board.typeLabel, width * (legacy ? 0.08 : 0.06), height * 0.87);
    ctx.fillStyle = spec.palette.muted;
    ctx.font = `400 ${legacy ? 20 : Math.round(width * 0.026)}px Arial, sans-serif`;
    ctx.fillText(spec.board.provenance, width * (legacy ? 0.08 : 0.06), height * (legacy ? 0.91 : 0.93));
  }
  if (spec.logo) {
    const logo = await loadCompositionImage(spec.logo.src);
    const boxW = spec.logo.width * spec.width / 100;
    const boxH = spec.logo.height * spec.height / 100;
    const scale = Math.min(boxW / logo.width, boxH / logo.height);
    if (spec.designSpec && spec.layoutVersion === 2) {
      // A separate identity plate protects supplied logos from photographic detail.
      const padding = spec.width * 0.012;
      ctx.fillStyle = spec.palette.canvas;
      ctx.fillRect(spec.logo.x * spec.width / 100 - padding, spec.logo.y * spec.height / 100 - padding,
        logo.width * scale + padding * 2, logo.height * scale + padding * 2);
    }
    ctx.drawImage(logo, spec.logo.x * spec.width / 100, spec.logo.y * spec.height / 100,
      logo.width * scale, logo.height * scale);
  }
  return canvas;
}

function drawText(ctx: CanvasRenderingContext2D, box: CompositionBox, spec: CompositionSpec) {
  ctx.fillStyle = box.color;
  ctx.font = compositionCssFont(box);
  ctx.textBaseline = "top";
  const width = box.width * spec.width / 100;
  const lines = wrapLines(box.text, width, value => ctx.measureText(value).width);
  // Report overflow instead of silently exporting cropped or overlapping copy.
  if (lines.length * box.fontSize * box.lineHeight > box.height * spec.height / 100) {
    throw new Error("This copy exceeds its text area. Shorten it or choose a taller format before exporting.");
  }
  if (lines.some(line => ctx.measureText(line).width > width)) {
    throw new Error("A word exceeds the text area. Shorten it before exporting.");
  }
  lines.forEach((line, index) => ctx.fillText(line, box.x * spec.width / 100,
    box.y * spec.height / 100 + index * box.fontSize * box.lineHeight));
}

export function loadCompositionImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A retained background or logo failed to load. Export was not marked complete."));
    img.src = src;
  });
}
