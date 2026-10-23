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

  it("keeps marketing on the dark cinema stage and workrooms on cream", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--emerald:\s*#248368;/);
    expect(css).toMatch(/--gold:\s*#c7a45a;/);
    expect(css).toMatch(/--ivory:\s*#f3f0e7;/);
    expect(css).toMatch(/--obsidian:\s*#080c0b;/);
    expect(css).toMatch(/--smoked:\s*#102e25;/);
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?--bg:\s*var\(--obsidian\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?--bg-raised:\s*var\(--smoked\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?--text:\s*var\(--ivory\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="workroom"\],\n\.app-root\[data-surface="atelier"\] \{[\s\S]*?--bg:\s*var\(--ivory\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?--bg-input:\s*#fff;/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?--bg-read:\s*#fff;/
    );
    expect(css).not.toMatch(/--garnet/);
    expect(css).toMatch(/--ink-glass-fill:/);
    expect(css).toMatch(/--cinema-grain:/);
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\] \{[\s\S]*?radial-gradient\(120% 80% at 50% -8%/
    );
    expect(css).toMatch(/backdrop-filter:\s*var\(--ink-glass-filter\)/);
  });
});
