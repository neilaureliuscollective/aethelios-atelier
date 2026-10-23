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

  it("uses cream as the room, smoked ink as raised furniture, and white for paper inputs", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--emerald:\s*#248368;/);
    expect(css).toMatch(/--gold:\s*#c7a45a;/);
    expect(css).toMatch(/--ivory:\s*#f3f0e7;/);
    expect(css).toMatch(/--ink:\s*#0e1c18;/);
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\],\n\.app-root\[data-surface="workroom"\],\n\.app-root\[data-surface="atelier"\] \{[\s\S]*?--bg:\s*var\(--ivory\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\],\n\.app-root\[data-surface="workroom"\],\n\.app-root\[data-surface="atelier"\] \{[\s\S]*?--bg-raised:\s*var\(--ink\);/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\],\n\.app-root\[data-surface="workroom"\],\n\.app-root\[data-surface="atelier"\] \{[\s\S]*?--bg-input:\s*#fff;/
    );
    expect(css).toMatch(
      /\.app-root\[data-surface="luminous"\],\n\.app-root\[data-surface="workroom"\],\n\.app-root\[data-surface="atelier"\] \{[\s\S]*?--bg-read:\s*#fff;/
    );
    expect(css).not.toMatch(/--garnet/);
  });
});
