import { describe, expect, it } from "vitest";
import { rmsFromTimeDomain, shouldFinishRecording, SILENCE_MS, MAX_RECORD_MS } from "./voiceListen";

describe("orb hearing", () => {
  it("measures silence versus a loud cycle", () => {
    expect(rmsFromTimeDomain(new Uint8Array(32).fill(128))).toBe(0);
    const loud = new Uint8Array(32);
    for (let i = 0; i < loud.length; i += 1) loud[i] = i % 2 ? 255 : 1;
    expect(rmsFromTimeDomain(loud)).toBeGreaterThan(0.5);
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
});
