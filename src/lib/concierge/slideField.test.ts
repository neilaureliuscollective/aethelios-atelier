import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { accentIndex, layoutIndex, moodIndex, seedFromId } from "./slideField";

describe("slide field signatures", () => {
  it("maps theme and layout into distinct generative inputs", () => {
    expect(moodIndex("obsidian")).not.toBe(moodIndex("ember"));
    expect(moodIndex("ember")).not.toBe(moodIndex("aurora"));
    expect(accentIndex("gold")).not.toBe(accentIndex("emerald"));
    expect(layoutIndex("hero")).not.toBe(layoutIndex("split"));
    expect(layoutIndex("stats")).not.toBe(layoutIndex("path"));
    expect(seedFromId("slide_hero")).not.toBe(seedFromId("slide_next"));
  });

  it("keeps the written document display-only", () => {
    const view = readFileSync("src/components/concierge/SlideView.tsx", "utf8");
    const canvas = readFileSync("src/components/concierge/PresentationCanvas.tsx", "utf8");
    expect(view).not.toContain("dangerouslySetInnerHTML");
    expect(view).not.toContain("SlideField");
    expect(view).toContain("data-layout={slide.layout}");
    expect(view).toContain("data-mood={theme.mood}");
    expect(view).toContain("data-accent={theme.accent}");
    expect(canvas).toContain("atelier-brief");
    expect(canvas).not.toContain("SlideField");
  });
});
