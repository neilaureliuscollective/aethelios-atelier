export function isLoopbackRehearsalOrigin(origin: string | undefined) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

export function sessionCookieSecure(input: { nodeEnv: string; publicOrigin?: string }) {
  if (input.nodeEnv !== "production") return false;
  return !isLoopbackRehearsalOrigin(input.publicOrigin);
}
