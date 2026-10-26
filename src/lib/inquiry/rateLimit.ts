const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;

/** In-memory, per-instance sliding window. A courtesy limit, not a spend cap. */
export function createRateLimiter(maxPerWindow: number, windowMs = WINDOW_MS) {
  const hits = new Map<string, number[]>();
  return {
    limited(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
      if (recent.length >= maxPerWindow) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      return false;
    },
    reset() {
      hits.clear();
    }
  };
}

const inquiries = createRateLimiter(MAX_PER_WINDOW);

export function resetInquiryRateLimitForTests() {
  inquiries.reset();
}

export function inquiryRateLimited(key: string, now = Date.now()): boolean {
  return inquiries.limited(key, now);
}
