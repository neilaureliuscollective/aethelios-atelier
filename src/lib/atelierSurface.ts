export type AtelierSurface = "luminous" | "studio" | "workroom" | "atelier";

export function atelierSurfaceForPath(pathname: string | null): AtelierSurface {
  if (!pathname) return "luminous";
  if (pathname.startsWith("/companion")) return "atelier";
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
