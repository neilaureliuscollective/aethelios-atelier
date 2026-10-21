import { describe, expect, it } from "vitest";
import {
  CINEMATIC_ENTER_RATIO,
  CINEMATIC_EXIT_RATIO,
  CINEMATIC_LOAD_RATIO,
  classifyPlayError,
  decideCinematicPlayback,
  isMeaningfullyVisible,
  isStalePlayGeneration,
  prefersStaticPlayback,
  readSaveData
} from "@/lib/work/cinematicPlayback";

describe("cinematic playback policy", () => {
  it("warms near the viewport and uses enter/exit hysteresis", () => {
    expect(CINEMATIC_LOAD_RATIO).toBeLessThan(CINEMATIC_EXIT_RATIO);
    expect(CINEMATIC_EXIT_RATIO).toBeLessThan(CINEMATIC_ENTER_RATIO);
    expect(isMeaningfullyVisible(0.2, false)).toBe(false);
    expect(isMeaningfullyVisible(0.2, true)).toBe(true);
    expect(isMeaningfullyVisible(0.4, false)).toBe(true);
    expect(isMeaningfullyVisible(0.1, true)).toBe(false);
    expect(
      decideCinematicPlayback({
        srcAttached: false,
        userPaused: false,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: false,
        prefersStatic: false,
        userRequestedPlay: false
      })
    ).toBe("attach");
    expect(
      decideCinematicPlayback({
        srcAttached: true,
        userPaused: false,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: true,
        prefersStatic: false,
        userRequestedPlay: false
      })
    ).toBe("play");
    expect(
      decideCinematicPlayback({
        srcAttached: true,
        userPaused: false,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: false,
        prefersStatic: false,
        userRequestedPlay: false
      })
    ).toBe("pause");
  });

  it("never undoes a deliberate pause and pauses hidden tabs", () => {
    expect(
      decideCinematicPlayback({
        srcAttached: true,
        userPaused: true,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: true,
        prefersStatic: false,
        userRequestedPlay: true
      })
    ).toBe("pause");
    expect(
      decideCinematicPlayback({
        srcAttached: true,
        userPaused: false,
        tabHidden: true,
        nearViewport: true,
        meaningfullyVisible: true,
        prefersStatic: false,
        userRequestedPlay: false
      })
    ).toBe("pause");
  });

  it("keeps reduced-motion and save-data on the poster until a deliberate play", () => {
    expect(prefersStaticPlayback(true, false)).toBe(true);
    expect(prefersStaticPlayback(false, true)).toBe(true);
    expect(readSaveData({ saveData: true })).toBe(true);
    expect(
      decideCinematicPlayback({
        srcAttached: false,
        userPaused: false,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: true,
        prefersStatic: true,
        userRequestedPlay: false
      })
    ).toBe("idle");
    expect(
      decideCinematicPlayback({
        srcAttached: false,
        userPaused: false,
        tabHidden: false,
        nearViewport: true,
        meaningfullyVisible: true,
        prefersStatic: true,
        userRequestedPlay: true
      })
    ).toBe("attach");
    expect(isStalePlayGeneration(2, 1)).toBe(true);
    expect(classifyPlayError(new DOMException("blocked", "NotAllowedError"))).toBe("blocked");
    expect(classifyPlayError(new DOMException("paused", "AbortError"))).toBe("aborted");
  });
});
