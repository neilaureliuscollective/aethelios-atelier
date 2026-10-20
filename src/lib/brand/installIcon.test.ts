import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function pngHeader(path: string) {
  const bytes = readFileSync(path);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25]
  };
}

describe("v7 install icon", () => {
  it("keeps the supplied emblem and a full-bleed plated derivative", () => {
    const mark = pngHeader("public/brand/original/icon-mark.png");
    const plate = pngHeader("public/brand/original/icon.png");
    expect(mark.width).toBe(1254);
    expect(mark.height).toBe(1254);
    expect(plate.width).toBe(1024);
    expect(plate.height).toBe(1024);
    expect(existsSync("public/brand/install/v7/icon-512.png")).toBe(true);
    expect(existsSync("public/brand/install/v7/icon-512-maskable.png")).toBe(true);
    expect(existsSync("public/brand/install/v7/apple-touch-icon.png")).toBe(true);
  });

  it("points the manifest and metadata at versioned v7 assets", () => {
    const manifest = readFileSync("public/manifest.webmanifest", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const sw = readFileSync("public/sw.js", "utf8");
    const builder = readFileSync("scripts/build-brand-icons.py", "utf8");
    expect(manifest).toContain("/brand/install/v7/icon-512.png");
    expect(manifest).toContain('purpose": "maskable"');
    expect(manifest).not.toContain("/brand/install/v6/");
    expect(layout).toContain("/brand/install/v7/apple-touch-icon.png");
    expect(sw).toContain("/brand/install/v7/icon-512-maskable.png");
    expect(builder).toContain('INSTALL_VERSION = "v7"');
    expect(builder).toContain("ANY_FILL = 0.78");
    expect(builder).toContain("MASKABLE_FILL = 0.62");
  });
});
