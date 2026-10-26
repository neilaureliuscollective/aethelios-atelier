/**
 * Public launch surface. Atelier launches as a public studio site: visitors read the
 * work, talk the business through with Aethelios, and send Neil the direction.
 * There are no visitor accounts, client workspaces, or voice sessions in this launch.
 */

/** The single way in: the Aethelios conversation on the homepage. */
export const BEGIN_HREF = "/#aethelios";
export const BEGIN_LABEL = "Begin with Aethelios";

/** Retired page routes and where each now sends a visitor. */
export const RETIRED_ROUTES = [
  { prefix: "/project", destination: BEGIN_HREF },
  { prefix: "/discover", destination: BEGIN_HREF },
  { prefix: "/account", destination: "/" },
  { prefix: "/companion", destination: "/" },
  { prefix: "/workspace", destination: "/" },
  { prefix: "/founder", destination: "/" }
] as const;

/** Private API families that served the retired routes. */
export const RETIRED_API_PREFIXES = [
  "/api/projects",
  "/api/founder",
  "/api/companion",
  "/api/session/sign-in",
  "/api/session/start",
  "/api/session/email",
  "/api/auth"
] as const;

export function isRetiredPath(pathname: string) {
  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  return RETIRED_ROUTES.some((route) => matches(route.prefix)) || RETIRED_API_PREFIXES.some(matches);
}
