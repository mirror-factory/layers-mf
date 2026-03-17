import { describe, it, expect, vi, beforeEach } from "vitest";
import { findCrossSourceConnections } from "../cross-source";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock the config module
vi.mock("../config", () => ({
  extractionModel: "mock-model",
}));

// Mock usage logger
vi.mock("../usage", () => ({
  logUsage: vi.fn(),
}));

// Mock supabase server
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

import { generateObject } from "ai";

const mockGenerateObject = vi.mocked(generateObject);

/**
 * Creates a chainable Supabase mock that supports arbitrary method chains.
 * Each method returns the same chain object, except terminal methods (single, limit)
 * which return resolved promises.
 */
function createMockSupabase(overrides?: {
  item?: Record<string, unknown> | null;
  itemError?: boolean;
  rpcResult?: { data: unknown[] | null; error: { message: string } | null };
  fallbackItems?: unknown[];
}) {
  const item = overrides?.itemError
    ? null
    : (overrides?.item ?? {
        id: "item-1",
        title: "Q1 Planning Meeting Notes",
        raw_content: "We decided to delay the launch to March 15.",
        source_type: "gdrive",
        content_type: "meeting_transcript",
        embedding: [0.1, 0.2, 0.3],
        description_short: "Q1 planning meeting with launch date decisions",
      });

  const itemError = overrides?.itemError
    ? { message: "not found" }
    : null;

  const rpcResult = overrides?.rpcResult ?? {
    data: null,
    error: { message: "function not found" },
  };

  const fallbackItems = overrides?.fallbackItems ?? [
    {
      id: "item-2",
      title: "Launch Sprint Issue",
      raw_content: "Launch deadline: March 1",
      source_type: "linear",
      content_type: "issue",
      description_short: "Sprint issue tracking launch for March 1",
    },
  ];

  // Track which table is being queried
  let callIndex = 0;

  const mockFrom = vi.fn().mockImplementation(() => {
    const currentCall = callIndex++;

    // Build a fully chainable object
    const createChain = (terminal: () => Promise<unknown>): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      const methods = ["select", "eq", "neq", "order", "in"];
      for (const method of methods) {
        chain[method] = vi.fn().mockReturnValue(chain);
      }
      chain.single = vi.fn().mockImplementation(terminal);
      chain.limit = vi.fn().mockImplementation(terminal);
      return chain;
    };

    if (currentCall === 0) {
      // First call: fetch the item
      return createChain(() =>
        Promise.resolve({ data: item, error: itemError })
      );
    } else {
      // Subsequent calls: fallback query for candidates
      return createChain(() =>
        Promise.resolve({ data: fallbackItems, error: null })
      );
    }
  });

  return {
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
}

describe("findCrossSourceConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no similar items from other sources", async () => {
    const supabase = createMockSupabase({
      rpcResult: { data: null, error: { message: "function not found" } },
      fallbackItems: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("item-1", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toEqual([]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("calls AI with correct prompt structure", async () => {
    const supabase = createMockSupabase();

    mockGenerateObject.mockResolvedValue({
      object: {
        connections: [
          {
            type: "contradicts",
            item_a_id: "item-1",
            item_b_id: "item-2",
            description:
              "Meeting notes say launch delayed to March 15, but Linear issue has March 1 deadline",
            confidence: 0.9,
            severity: "critical",
          },
        ],
      },
      usage: { inputTokens: 200, outputTokens: 50 },
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("item-1", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("contradicts");
    expect(result[0].severity).toBe("critical");
    expect(result[0].confidence).toBe(0.9);

    // Verify prompt includes both items
    const call = mockGenerateObject.mock.calls[0][0];
    expect(call.prompt).toContain("item-1");
    expect(call.prompt).toContain("Q1 Planning Meeting Notes");
    expect(call.prompt).toContain("Launch Sprint Issue");
    expect(call.prompt).toContain("contradicts");
    expect(call.prompt).toContain("supports");
  });

  it("filters out low-confidence connections (< 0.3)", async () => {
    const supabase = createMockSupabase();

    mockGenerateObject.mockResolvedValue({
      object: {
        connections: [
          {
            type: "supports",
            item_a_id: "item-1",
            item_b_id: "item-2",
            description: "Both mention the project",
            confidence: 0.2,
            severity: "info",
          },
          {
            type: "contradicts",
            item_a_id: "item-1",
            item_b_id: "item-2",
            description: "Conflicting deadlines",
            confidence: 0.85,
            severity: "critical",
          },
        ],
      },
      usage: { inputTokens: 200, outputTokens: 80 },
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("item-1", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("contradicts");
    expect(result[0].confidence).toBe(0.85);
  });

  it("handles AI errors gracefully (returns empty array)", async () => {
    const supabase = createMockSupabase();

    mockGenerateObject.mockRejectedValue(new Error("AI API unavailable"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("item-1", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toEqual([]);
  });

  it("returns empty array when item has no embedding", async () => {
    const supabase = createMockSupabase({
      item: {
        id: "item-1",
        title: "No Embedding Item",
        raw_content: "Some content",
        source_type: "upload",
        content_type: "document",
        embedding: null,
        description_short: "Item without embedding",
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("item-1", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toEqual([]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns empty array when item not found", async () => {
    const supabase = createMockSupabase({ itemError: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findCrossSourceConnections("nonexistent", "org-1", {
      supabase: supabase as any,
    });

    expect(result).toEqual([]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});
