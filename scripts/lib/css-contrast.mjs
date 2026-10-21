export function parseColor(value) {
  if (!value || value === "transparent") return null;
  const hex = String(value).match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [1, 3, 5].map((start) => parseInt(hex[1].slice(start - 1, start + 1), 16));
  }
  const rgb = String(value).match(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
  if (rgb) {
    const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (String(value).startsWith("rgba") && /,\s*0\)\s*$/.test(value)) return null;
    return channels;
  }
  const srgb = String(value).match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) {
    return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  }
  return null;
}

export function relativeLuminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
