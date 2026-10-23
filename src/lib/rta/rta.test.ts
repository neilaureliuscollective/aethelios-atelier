import { describe, expect, it } from "vitest";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";
import { conciergeVisibleOnPath, conciergePageContext } from "@/lib/concierge/pages";
import { conciergeRateLimited, resetConciergeRateLimitForTests } from "@/lib/concierge/rateLimit";
import { clipHistory, sanitizeConciergeMessage } from "@/lib/concierge/safety";
import { assignOrbKind, buildOrbParticles, goldShare, ORB_PARTICLE_COUNT } from "@/lib/rta/orb";
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

describe("Architect orb construction", () => {
  it("builds a particle sphere with a gold band and black showing through", () => {
    const particles = buildOrbParticles();
    expect(particles).toHaveLength(ORB_PARTICLE_COUNT);
    expect(goldShare(particles)).toBeGreaterThan(0.12);
    expect(goldShare(particles)).toBeLessThan(0.45);
    expect(assignOrbKind(0, 3)).toBe("gold");
    expect(assignOrbKind(0.9, 3)).toBe("emerald");
    expect(particles.every((particle) => particle.x ** 2 + particle.y ** 2 + particle.z ** 2 <= 1.05)).toBe(true);
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
