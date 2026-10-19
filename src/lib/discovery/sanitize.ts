export const LIMITS = {
  businessName: 80,
  headline: 120,
  audience: 280,
  note: 2000,
  short: 160
} as const;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.replace(CONTROL, "").replace(/\u0000/g, "").slice(0, max);
}

export function sanitizeMultiline(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, max);
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function displayName(businessName: string): string {
  const cleaned = collapseWhitespace(sanitizePlainText(businessName, LIMITS.businessName));
  return cleaned || "Your business";
}

export function looksLikeMarkup(value: string): boolean {
  return /<[^>]+>/.test(value) || /javascript:/i.test(value);
}
