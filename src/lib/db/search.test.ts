import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchContext,
  searchContextChunks,
  buildContextBlock,
  buildChunkContextBlock,
  SearchResult,
  ChunkSearchResult,
} from "./search";

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
    source_created_at: "2026-03-01T10:00:00Z",
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
    source_created_at: null,
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
      source_created_at: null,
      rrf_score: 0.5,
    };
    const block = buildContextBlock([result]);
    expect(block).toContain("(no summary)");
  });

  it("formats single result correctly", () => {
    const block = buildContextBlock([mockResults[0]]);
    expect(block).toContain("[1] Q3 Planning");
    expect(block).toContain("google-drive · meeting notes");
    expect(block).toContain("Full quarterly planning doc for Q3");
    // Should NOT contain a second entry
    expect(block).not.toContain("[2]");
  });
});

describe("searchContextChunks", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  const mockChunkResults: ChunkSearchResult[] = [
    {
      id: "c1",
      context_item_id: "1",
      title: "Q3 Planning",
      description_short: "Quarterly plan",
      parent_content: "Full parent content for chunk 1",
      source_type: "google-drive",
      content_type: "meeting_notes",
      source_url: "https://docs.google.com/doc/123",
      source_created_at: "2026-03-01T10:00:00Z",
      rrf_score: 0.85,
    },
    {
      id: "c2",
      context_item_id: "1",
      title: "Q3 Planning",
      description_short: "Quarterly plan",
      parent_content: "Full parent content for chunk 2",
      source_type: "google-drive",
      content_type: "meeting_notes",
      source_url: "https://docs.google.com/doc/123",
      source_created_at: "2026-03-01T10:00:00Z",
      rrf_score: 0.72,
    },
  ];

  function createMockChunkSupabase(
    rpcData: ChunkSearchResult[] | null,
    rpcError: Error | null = null
  ) {
    const rpcFn = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
    return { rpc: rpcFn } as unknown as Parameters<typeof searchContextChunks>[0];
  }

  it("returns empty array for nonsense query when RPC returns no results", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const supabase = createMockChunkSupabase([]);

    const results = await searchContextChunks(supabase, "org-1", "xyzzy9999gibberish");
    expect(results).toEqual([]);
  });

  it("passes sourceType filter to hybrid_search_chunks RPC", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const supabase = createMockChunkSupabase(mockChunkResults);

    await searchContextChunks(supabase, "org-1", "planning", 10, {
      sourceType: "upload",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith(
      "hybrid_search_chunks",
      expect.objectContaining({
        p_source_type: "upload",
        p_content_type: null,
      })
    );
  });

  it("passes contentType filter to hybrid_search_chunks RPC", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const supabase = createMockChunkSupabase(mockChunkResults);

    await searchContextChunks(supabase, "org-1", "planning", 10, {
      contentType: "document",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith(
      "hybrid_search_chunks",
      expect.objectContaining({
        p_source_type: null,
        p_content_type: "document",
      })
    );
  });

  it("passes date range filters to hybrid_search_chunks RPC", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const supabase = createMockChunkSupabase(mockChunkResults);

    await searchContextChunks(supabase, "org-1", "planning", 10, {
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith(
      "hybrid_search_chunks",
      expect.objectContaining({
        p_date_from: "2026-01-01",
        p_date_to: "2026-06-30",
      })
    );
  });

  it("passes limit=1 to RPC and returns at most 1 result", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const singleResult = [mockChunkResults[0]];
    const supabase = createMockChunkSupabase(singleResult);

    const results = await searchContextChunks(supabase, "org-1", "planning", 1);
    expect(results).toHaveLength(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase as any).rpc).toHaveBeenCalledWith(
      "hybrid_search_chunks",
      expect.objectContaining({ p_limit: 1 })
    );
  });

  it("falls back to text search when AI_GATEWAY_API_KEY is not set", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    // When no API key, searchContextChunks calls searchContext (text-only),
    // which calls hybrid_search_text RPC
    const rpcFn = vi.fn().mockResolvedValue({ data: mockResults, error: null });
    const supabase = { rpc: rpcFn } as unknown as Parameters<typeof searchContextChunks>[0];

    const results = await searchContextChunks(supabase, "org-1", "planning");

    // Should have called hybrid_search_text (text-only fallback)
    expect(rpcFn).toHaveBeenCalledWith(
      "hybrid_search_text",
      expect.objectContaining({
        p_org_id: "org-1",
        p_query_text: "planning",
      })
    );

    // Results should be mapped to ChunkSearchResult shape
    expect(results.length).toBe(mockResults.length);
    for (const r of results) {
      expect(r).toHaveProperty("context_item_id");
      expect(r).toHaveProperty("parent_content");
    }
  });

  it("falls back to old search when chunk RPC returns an error", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    // First call (hybrid_search_chunks) fails, second call (hybrid_search_text fallback inside searchContext) succeeds
    const rpcFn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("chunks table missing") })
      .mockResolvedValueOnce({ data: mockResults, error: null });
    const supabase = { rpc: rpcFn } as unknown as Parameters<typeof searchContextChunks>[0];

    const results = await searchContextChunks(supabase, "org-1", "planning");

    // Should have attempted hybrid_search_chunks first
    expect(rpcFn).toHaveBeenCalledWith(
      "hybrid_search_chunks",
      expect.any(Object)
    );
    // Results should be mapped from the fallback
    expect(results.length).toBe(mockResults.length);
  });
});

describe("buildChunkContextBlock", () => {
  it("returns 'No relevant context found.' for empty results", () => {
    expect(buildChunkContextBlock([])).toBe("No relevant context found.");
  });

  it("formats chunk results with index, title, source, and parent_content", () => {
    const chunkResults: ChunkSearchResult[] = [
      {
        id: "c1",
        context_item_id: "1",
        title: "Architecture Doc",
        description_short: null,
        parent_content: "The system uses a microservices architecture...",
        source_type: "upload",
        content_type: "document",
        source_url: null,
        source_created_at: null,
        rrf_score: 0.9,
      },
      {
        id: "c2",
        context_item_id: "2",
        title: "API Spec",
        description_short: null,
        parent_content: "REST endpoints for user management...",
        source_type: "github",
        content_type: "code",
        source_url: null,
        source_created_at: null,
        rrf_score: 0.8,
      },
    ];

    const block = buildChunkContextBlock(chunkResults);
    expect(block).toContain("[1] Architecture Doc (upload · document)");
    expect(block).toContain("The system uses a microservices architecture...");
    expect(block).toContain("[2] API Spec (github · code)");
    expect(block).toContain("REST endpoints for user management...");
    // Chunks are separated by --- dividers
    expect(block).toContain("---");
  });
});
