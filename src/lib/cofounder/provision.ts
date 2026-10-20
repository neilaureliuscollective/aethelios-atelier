export const DEFAULT_WORKSPACE_NAME = "Project workspace";

const PLACEHOLDER_NAMES = new Set([
  "your business",
  "untitled business",
  "project workspace"
]);

export function isPlaceholderBusinessName(name: string, displayName?: string) {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return true;
  if (displayName) {
    const possessive = `${displayName.trim()}’s business`;
    const ascii = `${displayName.trim()}'s business`;
    const workspace = `${displayName.trim()}’s workspace`;
    if (trimmed === possessive || trimmed === ascii || trimmed === workspace) return true;
  }
  return false;
}

export function canonicalOwnedBusiness<T extends { ownerId: string; createdAt: string }>(
  businesses: T[],
  ownerId: string
): T | undefined {
  return businesses
    .filter((business) => business.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.createdAt.localeCompare(b.createdAt))[0];
}
