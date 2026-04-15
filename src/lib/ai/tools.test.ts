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

vi.mock("@/lib/interactions/artifact-tracker", () => ({
  logArtifactInteraction: vi.fn(),
}));

vi.mock("@/lib/artifacts", () => ({
  createArtifact: vi.fn(),
  createVersion: vi.fn(),
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

  describe("artifact_get", () => {
    function createArtifactMockSupabase(interactions?: { interaction_type: string; created_at: string; chat_context: string | null }[]) {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "artifacts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "art-1",
                      title: "Dashboard",
                      type: "code",
                      content: "console.log('hello');",
                      language: "typescript",
                      current_version: 1,
                      description_oneliner: "A dashboard",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_interactions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: interactions ?? [],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_files") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        if (table === "artifact_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1 }),
            }),
          };
        }
        return {};
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { from: mockFrom, rpc: vi.fn() } as any;
    }

    it("includes interaction_history in the return value", async () => {
      const supabase = createArtifactMockSupabase([
        { interaction_type: "edited", created_at: "2026-04-10T10:00:00Z", chat_context: "User updated the title" },
        { interaction_type: "viewed", created_at: "2026-04-09T08:00:00Z", chat_context: null },
      ]);
      const tools = createTools(supabase, "org-1", "user-1");
      const result = await tools.artifact_get.execute!(
        { artifactId: "art-1" },
        { toolCallId: "tc-art-1", messages: [], abortSignal: new AbortController().signal }
      );

      expect(result).toHaveProperty("interaction_history");
      expect((result as { interaction_history: string }).interaction_history).toContain("edited");
      expect((result as { interaction_history: string }).interaction_history).toContain("User updated the title");
      expect((result as { interaction_history: string }).interaction_history).toContain("viewed");
    });

    it("returns 'No interaction history' when no interactions exist", async () => {
      const supabase = createArtifactMockSupabase([]);
      const tools = createTools(supabase, "org-1", "user-1");
      const result = await tools.artifact_get.execute!(
        { artifactId: "art-1" },
        { toolCallId: "tc-art-2", messages: [], abortSignal: new AbortController().signal }
      );

      expect((result as { interaction_history: string }).interaction_history).toBe("No interaction history");
    });

    it("returns 'No interaction history' when interactions query returns null", async () => {
      const supabase = createArtifactMockSupabase();
      // Override to return null data
      supabase.from.mockImplementation((table: string) => {
        if (table === "artifacts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "art-1", title: "Dashboard", type: "code", content: "x", language: "ts", current_version: 1 },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_interactions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          };
        }
        if (table === "artifact_files") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        if (table === "artifact_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1 }),
            }),
          };
        }
        return {};
      });

      const tools = createTools(supabase, "org-1", "user-1");
      const result = await tools.artifact_get.execute!(
        { artifactId: "art-1" },
        { toolCallId: "tc-art-3", messages: [], abortSignal: new AbortController().signal }
      );

      expect((result as { interaction_history: string }).interaction_history).toBe("No interaction history");
    });
  });
});
