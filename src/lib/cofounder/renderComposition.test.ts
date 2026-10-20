import { afterEach, describe, expect, it, vi } from "vitest";
import { buildComposition, defaultLayers } from "./composition";
import { compositionImageCrossOrigin, renderComposition } from "./renderComposition";
import { createDraft } from "@/lib/discovery";
import { trustedSpecFromDiscovery } from "@/lib/design-spec/fromDiscovery";

function canvasFixture() {
  const ctx = {
    fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), measureText: (text: string) => ({ width: text.length * 14 })
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() } });
  vi.stubGlobal("Image", class {
    width = 200; height = 100; naturalWidth = 200; naturalHeight = 100;
    onload: (() => void) | null = null;
    set src(_src: string) { this.onload?.(); }
  });
  return { ctx, canvas };
}

afterEach(() => vi.unstubAllGlobals());

describe("shared preview/export renderer", () => {
  it("clips retained imagery to its frame and paints exact editable text and proportional logo separately", async () => {
    const { ctx, canvas } = canvasFixture();
    const designSpec = trustedSpecFromDiscovery(createDraft(), "hearth");
    const spec = buildComposition({ layout: "website_banner", businessId: "biz", designSpec,
      layers: defaultLayers({ headline: "Our opening", body: "Visit tomorrow", layout: "website_banner", designSpec, logoDocumentId: "logo" }) });
    await renderComposition(spec, canvas);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(ctx.rect).toHaveBeenCalledWith(880, 0, 720, 900);
    expect(ctx.clip).toHaveBeenCalledOnce();
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(["Our opening", "Visit tomorrow"]);
    const logoCall = ctx.drawImage.mock.calls[1]!;
    expect(logoCall[3] / logoCall[4]).toBe(2);
    const firstPass = JSON.stringify(ctx.fillText.mock.calls);
    ctx.fillText.mockClear();
    await renderComposition(spec, canvas);
    expect(JSON.stringify(ctx.fillText.mock.calls)).toBe(firstPass);
  });

  it("renders a useful direction board with exact palette values and truthful provenance", async () => {
    const { ctx, canvas } = canvasFixture();
    const designSpec = trustedSpecFromDiscovery(createDraft(), "lumen");
    const spec = buildComposition({ layout: "direction_board", businessId: "biz", designSpec,
      layers: defaultLayers({ headline: "Northwind", body: "A thoughtful opening", layout: "direction_board", designSpec }) });
    await renderComposition(spec, canvas);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    const texts = ctx.fillText.mock.calls.map(call => call[0]);
    expect(texts).toContain(spec.palette.canvas.toUpperCase());
    expect(texts).toContain(spec.palette.accent.toUpperCase());
    expect(texts).toContain(spec.board?.typeLabel);
    expect(texts.some(text => text.includes("Curated concept — no live AI"))).toBe(true);
  });

  it("does not request CORS for same-origin workspace assets and does for foreign hosts", () => {
    expect(compositionImageCrossOrigin("/api/companion/assets/asset_1?businessId=biz")).toBeNull();
    expect(compositionImageCrossOrigin("data:image/png;base64,aaa")).toBeNull();
    expect(compositionImageCrossOrigin("https://foreign.example/logo.png")).toBe("anonymous");
  });

  it("refuses to silently export overflowing text", async () => {
    const { canvas } = canvasFixture();
    const spec = buildComposition({ layout: "square_announcement", businessId: "biz",
      layers: defaultLayers({ headline: "Long copy ".repeat(100), body: "" }) });
    await expect(renderComposition(spec, canvas)).rejects.toThrow("exceeds its text area");
  });
});
