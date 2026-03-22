import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CREDIT_COSTS,
  checkCredits,
  deductCredits,
  InsufficientCreditsError,
} from "../credits";

// Mock the Supabase admin client
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("CREDIT_COSTS", () => {
  it("has correct values for each operation", () => {
    expect(CREDIT_COSTS.chat).toBe(1);
    expect(CREDIT_COSTS.extraction).toBe(2);
    expect(CREDIT_COSTS.embedding).toBe(0.5);
    expect(CREDIT_COSTS.inbox_generation).toBe(1);
  });
});

describe("checkCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSelect(data: { credit_balance: number } | null, error: unknown = null) {
    mockSingle.mockResolvedValue({ data, error });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  }

  it("returns sufficient=true when balance > amount", async () => {
    setupSelect({ credit_balance: 100 });
    const result = await checkCredits("org-1", 10);
    expect(result.sufficient).toBe(true);
    expect(result.balance).toBe(100);
  });

  it("returns sufficient=true when balance equals amount", async () => {
    setupSelect({ credit_balance: 5 });
    const result = await checkCredits("org-1", 5);
    expect(result.sufficient).toBe(true);
    expect(result.balance).toBe(5);
  });

  it("returns sufficient=false when balance < amount", async () => {
    setupSelect({ credit_balance: 3 });
    const result = await checkCredits("org-1", 10);
    expect(result.sufficient).toBe(false);
    expect(result.balance).toBe(3);
  });

  it("returns sufficient=false when balance is 0", async () => {
    setupSelect({ credit_balance: 0 });
    const result = await checkCredits("org-1", 1);
    expect(result.sufficient).toBe(false);
    expect(result.balance).toBe(0);
  });

  it("returns sufficient=false when org not found", async () => {
    setupSelect(null, { message: "not found" });
    const result = await checkCredits("org-missing", 1);
    expect(result.sufficient).toBe(false);
    expect(result.balance).toBe(0);
  });

  it("queries the organizations table with correct org_id", async () => {
    setupSelect({ credit_balance: 50 });
    await checkCredits("org-123", 10);
    expect(mockFrom).toHaveBeenCalledWith("organizations");
    expect(mockSelect).toHaveBeenCalledWith("credit_balance");
    expect(mockEq).toHaveBeenCalledWith("id", "org-123");
  });
});

describe("deductCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reduces balance via RPC and returns new balance", async () => {
    mockRpc.mockResolvedValue({ data: 90, error: null });
    const result = await deductCredits("org-1", 10, "chat");
    expect(result).toBe(90);
    expect(mockRpc).toHaveBeenCalledWith("deduct_credits", { p_org_id: "org-1", p_amount: 10 });
  });

  it("handles fractional credit amounts", async () => {
    mockRpc.mockResolvedValue({ data: 7.5, error: null });
    const result = await deductCredits("org-1", 2.5, "sync:github");
    expect(result).toBe(7.5);
  });

  it("throws InsufficientCreditsError when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Insufficient credits" } });
    // Mock the fallback balance lookup
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { credit_balance: 3 }, error: null }) }) }),
    });
    await expect(deductCredits("org-1", 10, "chat")).rejects.toThrow(InsufficientCreditsError);
  });

  it("throws InsufficientCreditsError with correct balance and required", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Insufficient credits" } });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { credit_balance: 2 }, error: null }) }) }),
    });
    try {
      await deductCredits("org-1", 5, "chat");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientCreditsError);
      const e = err as InsufficientCreditsError;
      expect(e.balance).toBe(2);
      expect(e.required).toBe(5);
    }
  });

  it("throws when org not found", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Organization not found" } });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    });
    await expect(deductCredits("org-missing", 1, "chat")).rejects.toThrow(InsufficientCreditsError);
  });
});
