import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for conversation auto-embedding into context_items.
 *
 * The embedConversationIfReady function summarizes conversations with 20+
 * messages and stores/updates a context_items row so conversations become
 * searchable via hybrid search.
 */

// ── Mocks ──

// Mock generateText
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// Mock gateway
vi.mock("@/lib/ai/config", () => ({
  gateway: vi.fn((model: string) => ({ modelId: model })),
}));

// Mock supabase admin client
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
});
const mockSelectCount = vi.fn();
const mockSelectExisting = vi.fn();
const mockSelectMessages = vi.fn();
const mockSelectConv = vi.fn();

function buildChain(terminal: () => unknown) {
  // Builds a chainable query mock: .select().eq().eq().single() / .order().limit()
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(terminal);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(terminal);
  return chain;
}

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === "chat_messages") {
    return {
      select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) {
          // count query
          const chain = buildChain(() => ({}));
          chain.eq = vi.fn().mockImplementation(() => {
            return mockSelectCount();
          });
          return chain;
        }
        // messages query
        const chain = buildChain(() => mockSelectMessages());
        chain.eq = vi.fn().mockReturnValue(chain);
        return chain;
      }),
    };
  }
  if (table === "context_items") {
    return {
      select: vi.fn().mockImplementation(() => {
        const chain = buildChain(() => mockSelectExisting());
        chain.eq = vi.fn().mockReturnValue(chain);
        return chain;
      }),
      insert: mockInsert,
      update: mockUpdate,
    };
  }
  if (table === "conversations") {
    return {
      select: vi.fn().mockImplementation(() => {
        const chain = buildChain(() => mockSelectConv());
        chain.eq = vi.fn().mockReturnValue(chain);
        return chain;
      }),
    };
  }
  return {};
});

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// Import after mocks
import { embedConversationIfReady } from "../conversation-embedder";

/* ------------------------------------------------------------------ */
/*  Test setup                                                         */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();

  // Default: no existing context_items row
  mockSelectExisting.mockResolvedValue({ data: null, error: null });
  // Default: conversation title
  mockSelectConv.mockResolvedValue({ data: { title: "Test Conversation" }, error: null });
  // Default: generateText returns summary
  mockGenerateText.mockResolvedValue({ text: "This is a summary of the conversation." });
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("embedConversationIfReady", () => {
  it("skips when message count is below threshold (< 20)", async () => {
    mockSelectCount.mockReturnValue({ count: 10, error: null });

    await embedConversationIfReady("conv-1", "org-1");

    // Should not query for existing context_items or messages
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips when count is null", async () => {
    mockSelectCount.mockReturnValue({ count: null, error: null });

    await embedConversationIfReady("conv-2", "org-1");

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips when recently embedded (< 30 minutes ago)", async () => {
    mockSelectCount.mockReturnValue({ count: 25, error: null });
    // Existing row updated 10 minutes ago
    mockSelectExisting.mockResolvedValue({
      data: {
        id: "ci-1",
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    await embedConversationIfReady("conv-3", "org-1");

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates a new context_items row on first embed", async () => {
    mockSelectCount.mockReturnValue({ count: 30, error: null });
    mockSelectExisting.mockResolvedValue({ data: null, error: null });
    mockSelectMessages.mockReturnValue({
      data: [
        { role: "user", content: "Hello", created_at: "2026-01-01T00:00:00Z" },
        { role: "assistant", content: "Hi there!", created_at: "2026-01-01T00:00:01Z" },
      ],
      error: null,
    });

    await embedConversationIfReady("conv-4", "org-1");

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.org_id).toBe("org-1");
    expect(inserted.source_type).toBe("conversation");
    expect(inserted.source_id).toBe("conv-4");
    expect(inserted.title).toBe("Test Conversation");
    expect(inserted.raw_content).toBe("This is a summary of the conversation.");
    expect(inserted.metadata.message_count).toBe(30);
    expect(inserted.metadata.last_embedded).toBeDefined();
  });

  it("updates existing context_items row on subsequent embeds", async () => {
    mockSelectCount.mockReturnValue({ count: 40, error: null });
    // Existing row updated 45 minutes ago (past the 30-min threshold)
    mockSelectExisting.mockResolvedValue({
      data: {
        id: "ci-existing",
        updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      error: null,
    });
    mockSelectMessages.mockReturnValue({
      data: [
        { role: "user", content: "Follow-up question", created_at: "2026-01-01T01:00:00Z" },
        { role: "assistant", content: "Here is the answer.", created_at: "2026-01-01T01:00:01Z" },
      ],
      error: null,
    });

    await embedConversationIfReady("conv-5", "org-1");

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    // Should update, not insert
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const updated = mockUpdate.mock.calls[0][0];
    expect(updated.title).toBe("Test Conversation");
    expect(updated.raw_content).toBe("This is a summary of the conversation.");
    expect(updated.metadata.message_count).toBe(40);
    expect(updated.metadata.last_embedded).toBeDefined();
    expect(updated.updated_at).toBeDefined();
  });

  it("handles array content parts (filters to text only)", async () => {
    mockSelectCount.mockReturnValue({ count: 25, error: null });
    mockSelectExisting.mockResolvedValue({ data: null, error: null });
    mockSelectMessages.mockReturnValue({
      data: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this image?" },
            { type: "image", image: "base64..." },
          ],
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "It shows a chart." }],
          created_at: "2026-01-01T00:00:01Z",
        },
      ],
      error: null,
    });

    await embedConversationIfReady("conv-6", "org-1");

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const prompt = mockGenerateText.mock.calls[0][0].prompt;
    expect(prompt).toContain("User: What is this image?");
    expect(prompt).toContain("Assistant: It shows a chart.");
    expect(prompt).not.toContain("base64");
  });

  it("uses 'Untitled conversation' when conversation has no title", async () => {
    mockSelectCount.mockReturnValue({ count: 20, error: null });
    mockSelectExisting.mockResolvedValue({ data: null, error: null });
    mockSelectConv.mockResolvedValue({ data: { title: null }, error: null });
    mockSelectMessages.mockReturnValue({
      data: [
        { role: "user", content: "Hi", created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    });

    await embedConversationIfReady("conv-7", "org-1");

    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.title).toBe("Untitled conversation");
  });
});
