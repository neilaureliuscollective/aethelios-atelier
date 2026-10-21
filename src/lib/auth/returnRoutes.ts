/** Approved same-origin return paths after sign-in. Private payloads never belong here. */

const EXACT = new Set([
  "/",
  "/account",
  "/account/adopt",
  "/account/continue",
  "/companion",
  "/companion/confirm",
  "/companion/talk",
  "/companion/studio",
  "/companion/work",
  "/companion/business",
  "/discover",
  "/project",
  "/project/new",
  "/workspace",
  "/founder",
  "/pricing",
  "/services",
  "/custom-projects",
  "/install",
  "/offline",
  "/approach",
  "/about"
]);

const PREFIXES = [
  "/workspace/",
  "/project/",
  "/founder/",
  "/services/",
  "/discover?"
];

export function isApprovedReturnPath(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function approvedReturnPaths(): string[] {
  return [...EXACT];
}
