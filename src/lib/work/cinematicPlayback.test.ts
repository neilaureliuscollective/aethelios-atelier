import { describe, expect, it } from "vitest";
import {
  CINEMATIC_LOAD_RATIO,
  CINEMATIC_PLAY_RATIO,
  classifyPlayError,
  decideCinematicPlayback,
  isStalePlayGeneration,
  prefersStaticPlayback,
  readSaveData,
  shouldRestartLoop
} from "@/lib/work/cinematicPlayback";

describe("cinematic playback policy", () => {
  it("loads near the viewport and plays only when meaningfully visible", () => {
    expect(CINEMATIC_LOAD_RATIO).toBeLessThan(CINEMATIC_PLAY_RATIO);
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
  });

  it("restarts a mismatched ending before native loop would flash black", () => {
    expect(shouldRestartLoop(33.05, 33.1)).toBe(true);
    expect(shouldRestartLoop(12, 33.1)).toBe(false);
    expect(isStalePlayGeneration(2, 1)).toBe(true);
    expect(classifyPlayError(new DOMException("blocked", "NotAllowedError"))).toBe("blocked");
    expect(classifyPlayError(new DOMException("paused", "AbortError"))).toBe("aborted");
  });
});
