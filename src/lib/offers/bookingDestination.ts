export const BOOKING_PROVIDER_HINTS = ["glossgenius", "square", "booksy", "other"] as const;

export type BookingProviderHint = (typeof BOOKING_PROVIDER_HINTS)[number];

export type BookingDestinationKind = "empty" | "valid" | "unsupported" | "invalid";

export type BookingDestinationCheck = {
  ok: boolean;
  kind: BookingDestinationKind;
  href: string | null;
  providerHint: BookingProviderHint | null;
  message: string;
};

const PROVIDER_HOST: Array<{ hint: Exclude<BookingProviderHint, "other">; match: RegExp }> = [
  { hint: "glossgenius", match: /(^|\.)glossgenius\.com$/i },
  { hint: "square", match: /(^|\.)(squareup\.com|square\.site)$/i },
  { hint: "booksy", match: /(^|\.)booksy\.com$/i }
];

export function extractHttpUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    return new URL(match[0].replace(/[).,;]+$/, ""));
  } catch {
    return null;
  }
}

export function inferBookingProviderHint(value: string): BookingProviderHint | null {
  const lower = value.trim().toLowerCase();
  if (!lower) return null;
  const url = extractHttpUrl(value);
  const host = url?.hostname ?? "";
  for (const item of PROVIDER_HOST) {
    if ((host && item.match.test(host)) || lower.includes(item.hint)) return item.hint;
  }
  if (url) return "other";
  return null;
}

/**
 * Client-side shape check only. Never fetch, scrape, or follow the URL.
 */
export function checkBookingDestination(value: string): BookingDestinationCheck {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: true,
      kind: "empty",
      href: null,
      providerHint: null,
      message: "Unknown is fine. The booking destination can be added later."
    };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return {
      ok: false,
      kind: "invalid",
      href: null,
      providerHint: null,
      message: "Use an http or https booking address. Atelier does not fetch this URL."
    };
  }

  const looksLikeUrl = /https?:\/\//i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed);
  if (!looksLikeUrl) {
    const hint = inferBookingProviderHint(trimmed);
    return {
      ok: true,
      kind: "valid",
      href: null,
      providerHint: hint,
      message: bookingProviderMessage(hint, null)
    };
  }

  const href = /https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(href.replace(/[).,;]+$/, ""));
  } catch {
    return {
      ok: false,
      kind: "invalid",
      href: null,
      providerHint: null,
      message: "That booking address is not a usable http or https URL."
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      kind: "invalid",
      href: null,
      providerHint: null,
      message: "Use an http or https booking address. Atelier does not fetch this URL."
    };
  }

  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".invalid")) {
    return {
      ok: false,
      kind: "unsupported",
      href: parsed.toString(),
      providerHint: inferBookingProviderHint(trimmed),
      message: "Use the public booking page clients already open, not a local or placeholder address."
    };
  }

  const hint = inferBookingProviderHint(trimmed);
  return {
    ok: true,
    kind: hint === "other" ? "valid" : "valid",
    href: parsed.toString(),
    providerHint: hint,
    message: bookingProviderMessage(hint, parsed.toString())
  };
}

function bookingProviderMessage(hint: BookingProviderHint | null, href: string | null): string {
  switch (hint) {
    case "glossgenius":
      return href
        ? "GlossGenius’s public booking page is enough. Atelier will point visitors there rather than embedding a scheduler."
        : "A GlossGenius public booking page is enough. Atelier does not need account access.";
    case "square":
      return "Square documents website booking connections. An embed is used only when it has been tested for that site; otherwise the public booking link remains the action.";
    case "booksy":
      return "Booksy documents website connection options. If an embed is not tested for the site, the public booking link remains the action.";
    case "other":
      return "This can be recorded as the public booking destination. Atelier will not assume the provider supports an embed or account-free booking.";
    default:
      return href
        ? "This public address can be recorded. Atelier does not fetch it or move appointments into this brief."
        : "Name the booking tool you already use. A public URL can be added when you have it.";
  }
}
