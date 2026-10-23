import { describe, expect, it } from "vitest";
import {
  holdSpokenPhase,
  orbPresenceLabel,
  rmsFromTimeDomain,
  shouldFinishRecording,
  speechGain,
  SILENCE_MS,
  MAX_RECORD_MS
} from "./voiceListen";

describe("orb hearing", () => {
  it("measures silence versus a loud cycle", () => {
    expect(rmsFromTimeDomain(new Uint8Array(32).fill(128))).toBe(0);
    const loud = new Uint8Array(32);
    for (let i = 0; i < loud.length; i += 1) loud[i] = i % 2 ? 255 : 1;
    expect(rmsFromTimeDomain(loud)).toBeGreaterThan(0.5);
    expect(speechGain(0)).toBe(0);
    expect(speechGain(0.16)).toBeGreaterThan(0.8);
    expect(speechGain(0.04)).toBeGreaterThan(0);
    expect(speechGain(0.04)).toBeLessThan(0.3);
  });

  it("finishes after speech plus a pause, or when the clip is too long", () => {
    expect(
      shouldFinishRecording({ heardSpeech: false, lastLoudAt: 0, startedAt: 0, now: 1000 })
    ).toBe(false);
    expect(
      shouldFinishRecording({ heardSpeech: true, lastLoudAt: 1000, startedAt: 0, now: 1000 + SILENCE_MS - 1 })
    ).toBe(false);
    expect(
      shouldFinishRecording({ heardSpeech: true, lastLoudAt: 1000, startedAt: 0, now: 1000 + SILENCE_MS })
    ).toBe(true);
    expect(
      shouldFinishRecording({ heardSpeech: false, lastLoudAt: 0, startedAt: 0, now: MAX_RECORD_MS })
    ).toBe(true);
  });

  it("holds speaking until silence lasts, and keeps the status line still", () => {
    expect(
      holdSpokenPhase({ current: "listening", remoteLoud: true, loudForMs: 80, quietForMs: 0 })
    ).toBe("listening");
    expect(
      holdSpokenPhase({ current: "listening", remoteLoud: true, loudForMs: 180, quietForMs: 0 })
    ).toBe("speaking");
    expect(
      holdSpokenPhase({ current: "speaking", remoteLoud: false, loudForMs: 0, quietForMs: 200 })
    ).toBe("speaking");
    expect(
      holdSpokenPhase({ current: "speaking", remoteLoud: false, loudForMs: 0, quietForMs: 420 })
    ).toBe("listening");
    expect(orbPresenceLabel({ name: "Aethelios", phase: "listening" })).toBe("Listening");
    expect(orbPresenceLabel({ name: "Aethelios", phase: "speaking" })).toBe("Aethelios is speaking");
    expect(orbPresenceLabel({ name: "Aethelios", phase: "idle", pending: true, hasDocument: true })).toBe(
      "Aethelios is writing the document"
    );
  });
});
