export const RATE_LIMIT_TIERS = {
  free: { requestsPerHour: 50, burstSize: 10 },
  starter: { requestsPerHour: 500, burstSize: 50 },
  pro: { requestsPerHour: 5000, burstSize: 200 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

const store = new Map<string, number[]>();

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * Check rate limit for an org (or any key). Returns headers-ready info.
 *
 * Two checks are applied:
 * 1. Hourly limit (`requestsPerHour`) — sliding window over 1 hour
 * 2. Burst limit (`burstSize`) — sliding window over 1 minute
 *
 * Both must pass for the request to be allowed.
 */
export function checkRateLimit(
  orgId: string,
  tier: RateLimitTier = "free",
): RateLimitResult {
  const { requestsPerHour, burstSize } = RATE_LIMIT_TIERS[tier];
  const now = Date.now();

  const hourKey = `org:${orgId}:hour`;
  const burstKey = `org:${orgId}:burst`;

  // --- Hourly window ---
  const hourCutoff = now - HOUR_MS;
  const hourTimestamps = (store.get(hourKey) ?? []).filter((t) => t > hourCutoff);

  // --- Burst window (1 minute) ---
  const burstCutoff = now - MINUTE_MS;
  const burstTimestamps = (store.get(burstKey) ?? []).filter((t) => t > burstCutoff);

  const hourExceeded = hourTimestamps.length >= requestsPerHour;
  const burstExceeded = burstTimestamps.length >= burstSize;

  if (hourExceeded || burstExceeded) {
    store.set(hourKey, hourTimestamps);
    store.set(burstKey, burstTimestamps);

    // resetAt: earliest time a slot opens in whichever window is exceeded
    const resetAt = new Date(
      hourExceeded
        ? hourTimestamps[0] + HOUR_MS
        : burstTimestamps[0] + MINUTE_MS,
    );

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: requestsPerHour,
    };
  }

  hourTimestamps.push(now);
  burstTimestamps.push(now);
  store.set(hourKey, hourTimestamps);
  store.set(burstKey, burstTimestamps);

  return {
    allowed: true,
    remaining: requestsPerHour - hourTimestamps.length,
    resetAt: new Date(hourTimestamps[0] + HOUR_MS),
    limit: requestsPerHour,
  };
}

/** Build standard rate-limit response headers. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}

/**
 * @deprecated Use `checkRateLimit` for org-based rate limiting.
 * Kept for backward compatibility.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    store.set(key, timestamps);
    return { success: false, remaining: 0 };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { success: true, remaining: limit - timestamps.length };
}
