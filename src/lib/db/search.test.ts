import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchContext, buildContextBlock, SearchResult } from "./search";

// Mock the embed module
vi.mock("@/lib/ai/embed", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const mockResults: SearchResult[] = [
  {
    id: "1",
    title: "Q3 Planning",
    description_short: "Quarterly plan",
    description_long: "Full quarterly planning doc for Q3",
    source_type: "google-drive",
    content_type: "meeting_notes",
    source_url: "https://docs.google.com/doc/123",
    rrf_score: 0.85,
  },
  {
    id: "2",
    title: "API Design",
    description_short: "REST API spec",
    description_long: null,
    source_type: "github",
    content_type: "document",
    source_url: null,
    rrf_score: 0.72,
  },
];

function createMockSupabase(rpcData: SearchResult[] | null, rpcError: Error | null = null) {
  const rpcFn = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  return { rpc: rpcFn } as unknown as Parameters<typeof searchContext>[0];
}

describe("searchContext", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("uses hybrid RPC when AI_GATEWAY_API_KEY is set", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const supabase = createMockSupabase(mockResults);

    const results = await searchContext(supabase, "org-1", "planning", 5);

    expect(results).toEqual(mockResults);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith("hybrid_search", {
      p_org_id: "org-1",
      p_query_text: "planning",
      p_query_embedding: [0.1, 0.2, 0.3],
      p_limit: 5,
      p_source_type: null,
      p_content_type: null,
      p_date_from: null,
      p_date_to: null,
    });
  });

  it("uses text-only RPC when AI_GATEWAY_API_KEY is not set", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const supabase = createMockSupabase(mockResults);

    const results = await searchContext(supabase, "org-1", "planning");

    expect(results).toEqual(mockResults);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith("hybrid_search_text", {
      p_org_id: "org-1",
      p_query_text: "planning",
      p_limit: 10,
      p_source_type: null,
      p_content_type: null,
      p_date_from: null,
      p_date_to: null,
    });
  });

  it("passes filters to RPC call", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const supabase = createMockSupabase(mockResults);

    await searchContext(supabase, "org-1", "planning", 10, {
      sourceType: "upload",
      contentType: "document",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith("hybrid_search_text", {
      p_org_id: "org-1",
      p_query_text: "planning",
      p_limit: 10,
      p_source_type: "upload",
      p_content_type: "document",
      p_date_from: null,
      p_date_to: null,
    });
  });

  it("returns empty array when RPC returns null data", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const supabase = createMockSupabase(null);

    const results = await searchContext(supabase, "org-1", "nothing");
    expect(results).toEqual([]);
  });

  it("throws when RPC returns an error", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const supabase = createMockSupabase(null, new Error("RPC failed"));

    await expect(searchContext(supabase, "org-1", "fail")).rejects.toThrow("RPC failed");
  });
});

describe("buildContextBlock", () => {
  it("returns 'No relevant context found.' for empty results", () => {
    expect(buildContextBlock([])).toBe("No relevant context found.");
  });

  it("formats results with index, title, source, and description", () => {
    const block = buildContextBlock(mockResults);
    expect(block).toContain("[1] Q3 Planning (google-drive · meeting notes)");
    expect(block).toContain("Full quarterly planning doc for Q3");
    expect(block).toContain("[2] API Design (github · document)");
    expect(block).toContain("REST API spec"); // falls back to description_short when long is null
  });

  it("shows (no summary) when both descriptions are null", () => {
    const result: SearchResult = {
      id: "3",
      title: "Empty",
      description_short: null,
      description_long: null,
      source_type: "upload",
      content_type: "file",
      source_url: null,
      rrf_score: 0.5,
    };
    const block = buildContextBlock([result]);
    expect(block).toContain("(no summary)");
  });
});
