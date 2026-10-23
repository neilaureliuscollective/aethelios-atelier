const FORBIDDEN = /<\/?[a-z]|javascript:|dangerouslysetinnerhtml|\beval\s*\(|new\s+function\s*\(|data:text\/html|on\w+\s*=/i;

export function containsForbiddenPayload(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return FORBIDDEN.test(value);
  if (Array.isArray(value)) return value.some(containsForbiddenPayload);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsForbiddenPayload);
  }
  return false;
}

export const CONCIERGE_RENDER_CONTRACT = {
  input: "Validated PresentationDocument JSON only. Never JSX, HTML, or executable strings.",
  render: "Constrained view model. React text nodes and enum-driven layouts only.",
  forbidden: ["eval", "Function", "dangerouslySetInnerHTML", "arbitrary CSS injection", "unrestricted remote images"]
} as const;
