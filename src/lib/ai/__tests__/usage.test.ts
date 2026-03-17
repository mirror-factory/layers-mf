import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase server module
const mockInsert = vi.fn().mockReturnValue({ then: vi.fn() });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockAdminClient = { from: mockFrom };

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockAdminClient,
}));

import { logUsage } from "../usage";

describe("logUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ then: vi.fn() });
  });

  it("inserts into usage_logs with correct fields", () => {
    logUsage({
      orgId: "org-123",
      userId: "user-456",
      operation: "chat",
      model: "anthropic/claude-haiku-4-5-20251001",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.001,
      creditsUsed: 1,
      metadata: { query: "test" },
    });

    expect(mockFrom).toHaveBeenCalledWith("usage_logs");
    expect(mockInsert).toHaveBeenCalledWith({
      org_id: "org-123",
      user_id: "user-456",
      operation: "chat",
      model: "anthropic/claude-haiku-4-5-20251001",
      input_tokens: 100,
      output_tokens: 50,
      cost_usd: 0.001,
      credits_used: 1,
      metadata: { query: "test" },
    });
  });

  it("uses defaults for optional fields", () => {
    logUsage({
      orgId: "org-123",
      operation: "embedding",
      model: "openai/text-embedding-3-small",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      org_id: "org-123",
      user_id: null,
      operation: "embedding",
      model: "openai/text-embedding-3-small",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      credits_used: 0,
      metadata: {},
    });
  });

  it("does not throw on DB errors (fire-and-forget)", () => {
    mockInsert.mockImplementation(() => {
      throw new Error("DB connection failed");
    });

    expect(() => {
      logUsage({
        orgId: "org-123",
        operation: "extraction",
        model: "anthropic/claude-haiku-4-5-20251001",
      });
    }).not.toThrow();
  });

  it("does not throw when createAdminClient itself fails", () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Client creation failed");
    });

    expect(() => {
      logUsage({
        orgId: "org-123",
        operation: "query_expansion",
        model: "anthropic/claude-haiku-4-5-20251001",
      });
    }).not.toThrow();
  });
});
