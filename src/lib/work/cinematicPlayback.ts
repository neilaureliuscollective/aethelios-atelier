export const CINEMATIC_LOAD_RATIO = 0.01;
export const CINEMATIC_ENTER_RATIO = 0.34;
export const CINEMATIC_EXIT_RATIO = 0.14;
export const CINEMATIC_ROOT_MARGIN = "280px 0px 160px 0px";

export type CinematicPlaybackAction = "idle" | "attach" | "play" | "pause";

export function prefersStaticPlayback(reducedMotion: boolean, saveData: boolean) {
  return reducedMotion || saveData;
}

export function readSaveData(connection?: { saveData?: boolean } | null) {
  return Boolean(connection?.saveData);
}

export function isMeaningfullyVisible(ratio: number, wasVisible: boolean) {
  return wasVisible ? ratio >= CINEMATIC_EXIT_RATIO : ratio >= CINEMATIC_ENTER_RATIO;
}

export function decideCinematicPlayback(input: {
  srcAttached: boolean;
  userPaused: boolean;
  tabHidden: boolean;
  nearViewport: boolean;
  meaningfullyVisible: boolean;
  prefersStatic: boolean;
  userRequestedPlay: boolean;
}): CinematicPlaybackAction {
  if (input.userPaused) return input.srcAttached ? "pause" : "idle";

  const mayAutoAttach = !input.prefersStatic && input.nearViewport;
  const mayPlayFromFallback = input.prefersStatic && input.userRequestedPlay;
  if (!input.srcAttached) {
    return mayAutoAttach || mayPlayFromFallback || input.userRequestedPlay ? "attach" : "idle";
  }

  if (input.tabHidden) return "pause";
  if (input.userRequestedPlay && !input.tabHidden) {
    return input.meaningfullyVisible || mayPlayFromFallback ? "play" : "pause";
  }
  if (input.prefersStatic) return "pause";
  return input.meaningfullyVisible ? "play" : "pause";
}

export function isStalePlayGeneration(current: number, started: number) {
  return current !== started;
}

export function classifyPlayError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "AbortError") return "aborted" as const;
  if (name === "NotAllowedError") return "blocked" as const;
  return "error" as const;
}
