import { describe, it, expect, vi } from "vitest";
import { createTools } from "./tools";

// Mock searchContext and searchContextChunks
vi.mock("@/lib/db/search", () => ({
  searchContextChunks: vi.fn().mockResolvedValue([]),
  searchContext: vi.fn().mockResolvedValue([
    {
      id: "doc-1",
      title: "Sprint Retro",
      description_short: "Retro notes",
      description_long: "Full retro notes",
      source_type: "google-drive",
      content_type: "meeting_notes",
      source_url: "https://docs.google.com/retro",
      source_created_at: "2026-03-01T10:00:00Z",
      rrf_score: 0.9,
    },
  ]),
}));

function createMockSupabase() {
  return {
    rpc: vi.fn(),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "doc-1",
                title: "Sprint Retro",
                raw_content: "We discussed velocity improvements.",
                source_type: "google-drive",
                content_type: "meeting_notes",
                source_metadata: { url: "https://docs.google.com/retro" },
                source_created_at: "2026-03-01T10:00:00Z",
              },
              error: null,
            }),
          }),
        }),
        in: vi.fn().mockResolvedValue({ data: [{ id: "doc-1", source_id: null }] }),
      }),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("createTools", () => {
  it("returns search_context and get_document tools", () => {
    const tools = createTools(createMockSupabase(), "org-1");
    expect(tools).toHaveProperty("search_context");
    expect(tools).toHaveProperty("get_document");
  });

  it("search_context has a description and execute function", () => {
    const tools = createTools(createMockSupabase(), "org-1");
    const searchTool = tools.search_context;
    expect(searchTool).toHaveProperty("description");
    expect(searchTool).toHaveProperty("execute");
  });

  it("get_document has a description and execute function", () => {
    const tools = createTools(createMockSupabase(), "org-1");
    const docTool = tools.get_document;
    expect(docTool).toHaveProperty("description");
    expect(docTool).toHaveProperty("execute");
  });

  it("search_context.execute returns mapped results", async () => {
    const tools = createTools(createMockSupabase(), "org-1");
    const result = await tools.search_context.execute!(
      { query: "retro", limit: 5 },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    );
    expect(result).toEqual([
      {
        id: "doc-1",
        title: "Sprint Retro",
        source_type: "google-drive",
        content_type: "meeting_notes",
        rrf_score: 0.9,
        description_short: "Retro notes",
        source_url: "https://docs.google.com/retro",
        source_created_at: "2026-03-01T10:00:00Z",
      },
    ]);
  });

  it("get_document.execute returns document content", async () => {
    const supabase = createMockSupabase();
    const tools = createTools(supabase, "org-1");
    const result = await tools.get_document.execute!(
      { id: "doc-1" },
      { toolCallId: "tc-2", messages: [], abortSignal: new AbortController().signal }
    );
    expect(result).toEqual({
      title: "Sprint Retro",
      content: "We discussed velocity improvements.",
      source_type: "google-drive",
      content_type: "meeting_notes",
      source_url: "https://docs.google.com/retro",
      source_created_at: "2026-03-01T10:00:00Z",
    });
  });

  it("get_document.execute returns error when document not found", async () => {
    const supabase = createMockSupabase();
    // Override to simulate not found
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      }),
    });

    const tools = createTools(supabase, "org-1");
    const result = await tools.get_document.execute!(
      { id: "missing" },
      { toolCallId: "tc-3", messages: [], abortSignal: new AbortController().signal }
    );
    expect(result).toEqual({ error: "Document not found" });
  });
});
