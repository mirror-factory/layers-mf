import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Re-import fresh module for each test to reset the Map store
let rateLimit: typeof import("./rate-limit").rateLimit;
let checkRateLimit: typeof import("./rate-limit").checkRateLimit;
let rateLimitHeaders: typeof import("./rate-limit").rateLimitHeaders;
let RATE_LIMIT_TIERS: typeof import("./rate-limit").RATE_LIMIT_TIERS;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("./rate-limit");
  rateLimit = mod.rateLimit;
  checkRateLimit = mod.checkRateLimit;
  rateLimitHeaders = mod.rateLimitHeaders;
  RATE_LIMIT_TIERS = mod.RATE_LIMIT_TIERS;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Legacy rateLimit (backward compat) ──────────────────────────────

describe("rateLimit (legacy)", () => {
  it("allows requests under the limit", () => {
    const r1 = rateLimit("user-1", 3, 60_000);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit("user-1", 3, 60_000);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit("user-1", 3, 60_000);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit("user-2", 3, 60_000);
    }

    const blocked = rateLimit("user-2", 3, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 3; i++) {
      rateLimit("user-3", 3, 1_000);
    }

    const blocked = rateLimit("user-3", 3, 1_000);
    expect(blocked.success).toBe(false);

    // Advance time past the window
    vi.spyOn(Date, "now").mockReturnValue(now + 1_001);

    const allowed = rateLimit("user-3", 3, 1_000);
    expect(allowed.success).toBe(true);
    expect(allowed.remaining).toBe(2);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit("user-a", 3, 60_000);
    }

    const blockedA = rateLimit("user-a", 3, 60_000);
    expect(blockedA.success).toBe(false);

    const allowedB = rateLimit("user-b", 3, 60_000);
    expect(allowedB.success).toBe(true);
  });
});

// ── Per-org tier-based checkRateLimit ───────────────────────────────

describe("checkRateLimit", () => {
  it("defaults to free tier when no tier specified", () => {
    const result = checkRateLimit("org-1");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(RATE_LIMIT_TIERS.free.requestsPerHour);
  });

  it("allows requests under the hourly limit", () => {
    const result = checkRateLimit("org-2", "free");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_TIERS.free.requestsPerHour - 1);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it("different orgs have independent limits", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Exhaust org-a burst limit
    for (let i = 0; i < RATE_LIMIT_TIERS.free.burstSize; i++) {
      checkRateLimit("org-a", "free");
    }

    const blockedA = checkRateLimit("org-a", "free");
    expect(blockedA.allowed).toBe(false);

    // org-b should still be allowed
    const allowedB = checkRateLimit("org-b", "free");
    expect(allowedB.allowed).toBe(true);
  });

  it("blocks when burst limit is exceeded", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const burstSize = RATE_LIMIT_TIERS.free.burstSize; // 10

    for (let i = 0; i < burstSize; i++) {
      const r = checkRateLimit("org-burst", "free");
      expect(r.allowed).toBe(true);
    }

    const blocked = checkRateLimit("org-burst", "free");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("blocks when hourly limit is exceeded", () => {
    const now = Date.now();
    let currentTime = now;
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    const hourlyLimit = RATE_LIMIT_TIERS.free.requestsPerHour; // 50
    const burstSize = RATE_LIMIT_TIERS.free.burstSize; // 10

    // Send requests in bursts spread over time to avoid burst limit
    for (let i = 0; i < hourlyLimit; i++) {
      if (i > 0 && i % burstSize === 0) {
        // Advance 61 seconds to reset burst window
        currentTime += 61_000;
      }
      const r = checkRateLimit("org-hourly", "free");
      expect(r.allowed).toBe(true);
    }

    // Next request should be blocked by hourly limit
    currentTime += 61_000; // ensure burst window is fresh
    const blocked = checkRateLimit("org-hourly", "free");
    expect(blocked.allowed).toBe(false);
  });

  it("resets burst window after 1 minute", () => {
    const now = Date.now();
    let currentTime = now;
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    const burstSize = RATE_LIMIT_TIERS.free.burstSize;

    for (let i = 0; i < burstSize; i++) {
      checkRateLimit("org-burst-reset", "free");
    }

    expect(checkRateLimit("org-burst-reset", "free").allowed).toBe(false);

    // Advance past burst window (1 minute)
    currentTime += 60_001;

    const result = checkRateLimit("org-burst-reset", "free");
    expect(result.allowed).toBe(true);
  });

  describe("tier-based limits", () => {
    it("starter tier has higher limits than free", () => {
      expect(RATE_LIMIT_TIERS.starter.requestsPerHour).toBeGreaterThan(
        RATE_LIMIT_TIERS.free.requestsPerHour,
      );
      expect(RATE_LIMIT_TIERS.starter.burstSize).toBeGreaterThan(
        RATE_LIMIT_TIERS.free.burstSize,
      );

      const result = checkRateLimit("org-starter", "starter");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(RATE_LIMIT_TIERS.starter.requestsPerHour);
      expect(result.remaining).toBe(RATE_LIMIT_TIERS.starter.requestsPerHour - 1);
    });

    it("pro tier has higher limits than starter", () => {
      expect(RATE_LIMIT_TIERS.pro.requestsPerHour).toBeGreaterThan(
        RATE_LIMIT_TIERS.starter.requestsPerHour,
      );
      expect(RATE_LIMIT_TIERS.pro.burstSize).toBeGreaterThan(
        RATE_LIMIT_TIERS.starter.burstSize,
      );

      const result = checkRateLimit("org-pro", "pro");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(RATE_LIMIT_TIERS.pro.requestsPerHour);
    });

    it("starter org is not blocked when free burst limit would be exceeded", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const freeBurst = RATE_LIMIT_TIERS.free.burstSize; // 10

      // Send more than free burst limit
      for (let i = 0; i < freeBurst + 5; i++) {
        const r = checkRateLimit("org-starter-burst", "starter");
        expect(r.allowed).toBe(true);
      }
    });
  });
});

// ── rateLimitHeaders ────────────────────────────────────────────────

describe("rateLimitHeaders", () => {
  it("returns correct header format", () => {
    const resetAt = new Date("2026-03-17T12:00:00Z");
    const result = {
      allowed: true,
      remaining: 42,
      resetAt,
      limit: 50,
    };

    const headers = rateLimitHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("50");
    expect(headers["X-RateLimit-Remaining"]).toBe("42");
    expect(headers["X-RateLimit-Reset"]).toBe(
      String(Math.ceil(resetAt.getTime() / 1000)),
    );
  });

  it("returns zero remaining when blocked", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      remaining: 0,
      resetAt: new Date(),
      limit: 50,
    });

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Limit"]).toBe("50");
  });

  it("includes all three standard headers", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      remaining: 10,
      resetAt: new Date(),
      limit: 100,
    });

    expect(Object.keys(headers)).toEqual(
      expect.arrayContaining([
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ]),
    );
    expect(Object.keys(headers)).toHaveLength(3);
  });
});
