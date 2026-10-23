export type AetheliosSurface = "hero" | "dock" | "page" | "hidden";

export function aetheliosSurfaceForPath(pathname: string | null): AetheliosSurface {
  if (!pathname) return "dock";
  if (pathname === "/") return "hero";
  if (pathname.startsWith("/companion/talk")) return "page";
  if (pathname.startsWith("/offline")) return "hidden";
  return "dock";
}

export function aetheliosDockVisible(pathname: string | null) {
  return aetheliosSurfaceForPath(pathname) === "dock";
}
