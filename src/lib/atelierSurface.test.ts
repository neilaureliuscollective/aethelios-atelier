import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";

describe("atelierSurfaceForPath", () => {
  it("scopes the owner workspace without recoloring public or discovery routes", () => {
    expect(atelierSurfaceForPath("/companion")).toBe("atelier");
    expect(atelierSurfaceForPath("/companion/studio")).toBe("atelier");
    expect(atelierSurfaceForPath("/")).toBe("luminous");
    expect(atelierSurfaceForPath("/services")).toBe("luminous");
    expect(atelierSurfaceForPath("/services/barbers-salons")).toBe("luminous");
    expect(atelierSurfaceForPath("/services/commerce")).toBe("luminous");
    expect(atelierSurfaceForPath("/discover")).toBe("luminous");
    expect(atelierSurfaceForPath("/account")).toBe("workroom");
  });

  it("keeps inactive workspace nav and on-glass ghost buttons on the ivory-on-emerald tokens", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(
      /\.app-root\[data-surface="atelier"\] \.workspace-nav a \{[^}]*color: var\(--atelier-on-glass-muted\)/
    );
    expect(css).toMatch(/\.on-glass \.btn-ghost \{[^}]*color: var\(--atelier-on-glass\)/);
    expect(css).not.toMatch(
      /\.app-root\[data-surface="atelier"\] \.workspace-nav a \{[^}]*color: var\(--text-muted\)/
    );
  });
});
