export type AtelierSurface = "luminous" | "studio" | "workroom";

export function atelierSurfaceForPath(pathname: string | null): AtelierSurface {
  if (!pathname) return "luminous";
  if (pathname.startsWith("/discover")) return "luminous";
  if (
    pathname.startsWith("/project") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/founder") ||
    pathname.startsWith("/offline")
  ) {
    return "workroom";
  }
  return "luminous";
}
