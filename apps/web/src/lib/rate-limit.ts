type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { limited: false, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return { limited: true, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { limited: false, remaining: limit - current.count, resetAt: current.resetAt };
}

export function resetRateLimitForTests() {
  buckets.clear();
}
