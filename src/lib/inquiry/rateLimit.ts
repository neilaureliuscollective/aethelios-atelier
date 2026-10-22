const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;

const hits = new Map<string, number[]>();

export function resetInquiryRateLimitForTests() {
  hits.clear();
}

export function inquiryRateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}
