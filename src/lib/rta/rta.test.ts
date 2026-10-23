import { describe, expect, it } from "vitest";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";
import { conciergeVisibleOnPath, conciergePageContext } from "@/lib/concierge/pages";
import { conciergeRateLimited, resetConciergeRateLimitForTests } from "@/lib/concierge/rateLimit";
import { clipHistory, sanitizeConciergeMessage } from "@/lib/concierge/safety";
import { envelopeToward, hexToRgb, ORB_EMERALD, springStep, stateWeights } from "@/lib/rta/orb";
import { RTA_HISTORY_LIMIT, RTA_MESSAGE_MAX, RTA_RATE_MAX } from "@/lib/rta/limits";
import {
  chunkSpokenText,
  mergeTranscript,
  rmsFromTimeDomain,
  shouldFlushUtterance,
  shouldRestartRecognition,
  spokenForRta
} from "@/lib/rta/speech";

describe("Aethelios RTA conversation limits", () => {
  it("keeps long-form spoken answers instead of a two-sentence clip", () => {
    const long = [
      "Start with who already pays you, not the service name.",
      "A shop that wants to grow usually has a visibility problem or an offer problem.",
      "If people cannot tell what you do from the first screen, a clearer site comes first.",
      "If they already understand you and still do not book, look at the offer and the next step.",
      "We can stay with that until it is named. There is no need to send a brief yet."
    ].join(" ");
    const spoken = spokenForRta(long);
    expect(spoken.split(/(?<=[.!?])\s+/).length).toBeGreaterThan(2);
    expect(spoken).toMatch(/no need to send a brief yet/);
  });

  it("chunks speech so a Chrome network voice is not cut at fifteen seconds", () => {
    const chunks = chunkSpokenText(
      "First thought is complete. Second thought is also complete. Third thought stays with the visitor. Fourth thought names the next useful step.",
      40
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 40)).toBe(true);
    expect(chunks.join(" ")).toMatch(/next useful step/);
  });

  it("waits for a thinking pause before sending a spoken turn", () => {
    expect(
      shouldFlushUtterance({
        lastResultAt: 1_000,
        now: 1_200,
        text: "I run a salon and I want more of the right clients"
      })
    ).toBe(false);
    expect(
      shouldFlushUtterance({
        lastResultAt: 1_000,
        now: 3_000,
        text: "I run a salon and I want more of the right clients"
      })
    ).toBe(true);
    expect(shouldFlushUtterance({ lastResultAt: 1_000, now: 4_000, text: "hi" })).toBe(false);
    expect(mergeTranscript(["I run a salon"], "and I want to grow")).toBe("I run a salon and I want to grow");
  });

  it("restarts recognition after silence, not after a blocked microphone", () => {
    expect(shouldRestartRecognition("no-speech")).toBe(true);
    expect(shouldRestartRecognition("network")).toBe(true);
    expect(shouldRestartRecognition(undefined)).toBe(true);
    expect(shouldRestartRecognition("not-allowed")).toBe(false);
    expect(shouldRestartRecognition("service-not-allowed")).toBe(false);
  });

  it("accepts longer RTA turns and more history than the dock widget", () => {
    const long = "x".repeat(4000);
    expect(sanitizeConciergeMessage(long, RTA_MESSAGE_MAX).length).toBe(4000);
    expect(sanitizeConciergeMessage(long).length).toBe(2000);
    const history = Array.from({ length: 36 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      body: `turn ${index}`
    }));
    expect(clipHistory(history).length).toBe(12);
    expect(clipHistory(history, RTA_HISTORY_LIMIT, RTA_MESSAGE_MAX).length).toBe(36);
  });

  it("gives RTA a higher hourly ceiling without changing the public dock limit", () => {
    resetConciergeRateLimitForTests();
    const now = 1_800_000_000_000;
    for (let i = 0; i < RTA_RATE_MAX; i += 1) {
      expect(conciergeRateLimited("rta-ip", now + i, RTA_RATE_MAX)).toBe(false);
    }
    expect(conciergeRateLimited("rta-ip", now + 90, RTA_RATE_MAX)).toBe(true);
    expect(conciergeRateLimited("dock-ip", now)).toBe(false);
  });
});

describe("Architect orb motion", () => {
  it("keeps brand emerald and treats amplitude as depth, not a snap", () => {
    expect(hexToRgb(ORB_EMERALD)).toEqual([36 / 255, 131 / 255, 104 / 255]);
    const rising = envelopeToward(0.1, 0.9, 0.02, 0.045, 0.24);
    const falling = envelopeToward(0.9, 0.1, 0.02, 0.045, 0.24);
    expect(rising).toBeGreaterThan(0.1);
    expect(rising).toBeLessThan(0.55);
    expect(falling).toBeLessThan(0.9);
    expect(falling).toBeGreaterThan(0.7);
  });

  it("springs listen and speak as separate states", () => {
    expect(stateWeights("listening")).toEqual({ idle: 0, listen: 1, think: 0, speak: 0 });
    expect(stateWeights("speaking")).toEqual({ idle: 0, listen: 0, think: 0, speak: 1 });
    expect(stateWeights("thinking")).toEqual({ idle: 0, listen: 0, think: 1, speak: 0 });
    const next = springStep({ value: 0, vel: 0 }, 1, 0.016);
    expect(next.value).toBeGreaterThan(0);
    expect(next.value).toBeLessThan(1);
  });

  it("reads microphone amplitude from time-domain samples", () => {
    expect(rmsFromTimeDomain(new Array(32).fill(128))).toBe(0);
    expect(rmsFromTimeDomain([128, 200, 40, 180])).toBeGreaterThan(0.4);
  });
});

describe("RTA surface", () => {
  it("uses a dedicated black room and hides the dock concierge", () => {
    expect(atelierSurfaceForPath("/rta")).toBe("rta");
    expect(conciergeVisibleOnPath("/rta")).toBe(false);
    expect(conciergePageContext("/rta").title).toMatch(/RTA/i);
  });
});
