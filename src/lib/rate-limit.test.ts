import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Re-import fresh module for each test to reset the Map store
let rateLimit: typeof import("./rate-limit").rateLimit;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("./rate-limit");
  rateLimit = mod.rateLimit;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rateLimit", () => {
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
