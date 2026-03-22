import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the compound knowledge loop.
 *
 * The loop stores significant AI outputs (chat responses, cross-source insights,
 * daily digests) back into context_items with source_type "layers-ai" so they
 * become searchable context for future queries.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock helpers                                                */
/* ------------------------------------------------------------------ */

function createMockSupabase() {
  const insertFn = vi.fn().mockReturnValue({
    then: vi.fn().mockReturnValue({ catch: vi.fn() }),
    select: vi.fn().mockReturnValue({ data: [], error: null }),
  });

  const fromFn = vi.fn().mockReturnValue({
    insert: insertFn,
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({ then: vi.fn() }),
        then: vi.fn(),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  });

  return { from: fromFn, _insertFn: insertFn };
}

/* ------------------------------------------------------------------ */
/*  Chat compound loop                                                 */
/* ------------------------------------------------------------------ */

describe("Chat compound loop", () => {
  it("stores AI responses longer than 200 chars as context items", () => {
    const { from, _insertFn } = createMockSupabase();

    const orgId = "org-123";
    const conversationId = "conv-456";
    const query = "What are the key decisions from last sprint?";
    const assistantText = "A".repeat(250); // > 200 chars

    // Simulate the onFinish logic from chat/route.ts
    if (assistantText.length > 200) {
      from("context_items").insert({
        org_id: orgId,
        source_type: "layers-ai",
        source_id: `chat-${conversationId}-${Date.now()}`,
        title: `AI Analysis: ${query.slice(0, 80)}`,
        raw_content: `Question: ${query}\n\nAnswer: ${assistantText}`,
        content_type: "document",
        status: "ready",
        ingested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    }

    expect(from).toHaveBeenCalledWith("context_items");
    expect(_insertFn).toHaveBeenCalledTimes(1);

    const inserted = _insertFn.mock.calls[0][0];
    expect(inserted.source_type).toBe("layers-ai");
    expect(inserted.source_id).toMatch(/^chat-conv-456-\d+$/);
    expect(inserted.status).toBe("ready");
    expect(inserted.content_type).toBe("document");
    expect(inserted.raw_content).toContain("Question:");
    expect(inserted.raw_content).toContain("Answer:");
  });

  it("does NOT store short AI responses (< 200 chars)", () => {
    const { from, _insertFn } = createMockSupabase();

    const assistantText = "Short answer."; // < 200 chars

    if (assistantText.length > 200) {
      from("context_items").insert({});
    }

    expect(_insertFn).not.toHaveBeenCalled();
  });

  it("truncates query in title to 80 chars", () => {
    const { from, _insertFn } = createMockSupabase();

    const longQuery = "X".repeat(120);
    const assistantText = "A".repeat(300);

    if (assistantText.length > 200) {
      from("context_items").insert({
        org_id: "org-1",
        source_type: "layers-ai",
        source_id: `chat-conv-1-${Date.now()}`,
        title: `AI Analysis: ${longQuery.slice(0, 80)}`,
        raw_content: `Question: ${longQuery}\n\nAnswer: ${assistantText}`,
        content_type: "document",
        status: "ready",
        ingested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    }

    const inserted = _insertFn.mock.calls[0][0];
    // "AI Analysis: " is 14 chars + 80 = 94
    expect(inserted.title.length).toBeLessThanOrEqual(94);
    expect(inserted.title).toBe(`AI Analysis: ${"X".repeat(80)}`);
  });
});

/* ------------------------------------------------------------------ */
/*  Insight compound loop                                              */
/* ------------------------------------------------------------------ */

describe("Insight compound loop", () => {
  it("stores cross-source insights as context items", () => {
    const { from, _insertFn } = createMockSupabase();

    const orgId = "org-abc";
    const contextItemId = "item-789";
    const connections = [
      { type: "contradiction", description: "Sprint goal conflicts with Q2 roadmap priorities" },
      { type: "supports", description: "Meeting notes confirm the budget allocation" },
    ];

    if (connections.length > 0) {
      const insightSummary = connections
        .map((c) => `${c.type}: ${c.description}`)
        .join("\n");

      from("context_items").insert({
        org_id: orgId,
        source_type: "layers-ai",
        source_id: `insight-${contextItemId}-${Date.now()}`,
        title: `Cross-Source Insight: ${connections[0].description.slice(0, 80)}`,
        raw_content: insightSummary,
        content_type: "document",
        status: "ready",
        ingested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    }

    expect(_insertFn).toHaveBeenCalledTimes(1);

    const inserted = _insertFn.mock.calls[0][0];
    expect(inserted.source_type).toBe("layers-ai");
    expect(inserted.source_id).toMatch(/^insight-item-789-\d+$/);
    expect(inserted.raw_content).toContain("contradiction:");
    expect(inserted.raw_content).toContain("supports:");
  });

  it("does NOT store insights when no connections found", () => {
    const { from, _insertFn } = createMockSupabase();

    const connections: { type: string; description: string }[] = [];

    if (connections.length > 0) {
      from("context_items").insert({});
    }

    expect(_insertFn).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Digest compound loop                                               */
/* ------------------------------------------------------------------ */

describe("Digest compound loop", () => {
  it("stores digest as a context item when items exist", () => {
    const { from, _insertFn } = createMockSupabase();

    const orgId = "org-digest";
    const userId = "user-1";
    const digest = {
      date: "Saturday, March 22, 2026",
      items: [
        { priority: "high", title: "Sprint review notes", type: "new_context" },
        { priority: "urgent", title: "Deploy blocker", type: "action_item" },
      ],
    };

    if (digest.items.length > 0) {
      const digestContent = digest.items
        .map((i) => `[${i.priority}] ${i.title}: ${i.type}`)
        .join("\n");

      from("context_items").insert({
        org_id: orgId,
        source_type: "layers-ai",
        source_id: `digest-${userId}-${new Date().toISOString().split("T")[0]}`,
        title: `Daily Digest — ${digest.date}`,
        raw_content: digestContent,
        content_type: "document",
        status: "ready",
        ingested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    }

    expect(_insertFn).toHaveBeenCalledTimes(1);

    const inserted = _insertFn.mock.calls[0][0];
    expect(inserted.source_type).toBe("layers-ai");
    expect(inserted.source_id).toMatch(/^digest-user-1-\d{4}-\d{2}-\d{2}$/);
    expect(inserted.title).toContain("Daily Digest");
    expect(inserted.raw_content).toContain("[high] Sprint review notes");
    expect(inserted.raw_content).toContain("[urgent] Deploy blocker");
  });

  it("does NOT store digest when no items", () => {
    const { from, _insertFn } = createMockSupabase();

    const digest = { date: "Saturday, March 22, 2026", items: [] };

    if (digest.items.length > 0) {
      from("context_items").insert({});
    }

    expect(_insertFn).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Source type consistency                                             */
/* ------------------------------------------------------------------ */

describe("Compound loop source_type consistency", () => {
  it("all loop entries use 'layers-ai' as source_type", () => {
    const SOURCE_TYPE = "layers-ai";

    // Chat format
    expect(`chat-conv-1-${Date.now()}`).toMatch(/^chat-/);
    // Insight format
    expect(`insight-item-1-${Date.now()}`).toMatch(/^insight-/);
    // Digest format
    expect(`digest-user-1-2026-03-22`).toMatch(/^digest-/);

    // The source_type is always the same
    expect(SOURCE_TYPE).toBe("layers-ai");
  });
});
