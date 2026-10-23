import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aetheliosDockVisible, aetheliosSurfaceForPath } from "./presence";

describe("Aethelios presence surfaces", () => {
  it("keeps the homepage as the hero orb and docks everywhere else", () => {
    expect(aetheliosSurfaceForPath("/")).toBe("hero");
    expect(aetheliosSurfaceForPath("/discover")).toBe("dock");
    expect(aetheliosSurfaceForPath("/project")).toBe("dock");
    expect(aetheliosSurfaceForPath("/pricing")).toBe("dock");
    expect(aetheliosSurfaceForPath("/companion")).toBe("dock");
    expect(aetheliosSurfaceForPath("/companion/studio")).toBe("dock");
    expect(aetheliosSurfaceForPath("/companion/talk")).toBe("page");
    expect(aetheliosSurfaceForPath("/offline")).toBe("hidden");
    expect(aetheliosDockVisible("/approach")).toBe(true);
    expect(aetheliosDockVisible("/")).toBe(false);
  });

  it("mounts one presence from the app shell, not a second homepage chat", () => {
    const shell = readFileSync("src/components/shell/SessionShell.tsx", "utf8");
    const home = readFileSync("src/app/page.tsx", "utf8");
    const stage = readFileSync("src/components/concierge/ConciergeStage.tsx", "utf8");
    expect(shell).toContain("AetheliosProvider");
    expect(shell).toContain("AetheliosDock");
    expect(home).toContain("<ConciergeStage");
    expect(stage).toContain("useAethelios");
    expect(stage).toContain("StageAtmosphere");
    expect(stage).not.toContain("colonnade.webp");
    expect(stage).not.toContain("Talk with Aethelios");
    expect(stage).not.toMatch(/btn-gold/);
    expect(stage).toContain("INTELLIGENCE_DISPLAY_NAME");
  });
});
