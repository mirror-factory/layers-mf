import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchRecentContextItems,
  fetchOverdueActionItems,
  fetchExistingInboxKeys,
  generateInboxItemsAI,
  generateInboxForUser,
  GeneratedInboxItem,
} from "./generate";

// Mock AI SDK — all AI calls go through Vercel AI Gateway only
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    array: vi.fn((opts: unknown) => ({ type: "array", ...(opts as object) })),
  },
}));

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn().mockReturnValue("mock-gateway-model"),
}));

// --- Fixtures ---

const SEED_CONTEXT_ITEMS = [
  {
    id: "ctx-1",
    title: "Q1 Planning Meeting",
    description_short: "Team discussed Q1 priorities and assigned owners",
    source_type: "google-drive",
    content_type: "meeting_notes",
    entities: {
      people: ["Alice", "Bob"],
      topics: ["Q1 roadmap"],
      action_items: ["Alice to draft PRD by Friday", "Bob to review API spec"],
      decisions: ["Moving to weekly sprints"],
    },
    ingested_at: new Date().toISOString(),
    status: "ready",
  },
  {
    id: "ctx-2",
    title: "Slack channel update",
    description_short: "Deployment notification",
    source_type: "slack",
    content_type: "message",
    entities: { people: [], topics: ["deploy"], action_items: [], decisions: [] },
    ingested_at: new Date().toISOString(),
    status: "ready",
  },
];

const SEED_OVERDUE_ITEMS = [
  {
    id: "inbox-old-1",
    title: "Review design mockups",
    context_item_id: "ctx-old",
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

const AI_GENERATED_ITEMS: GeneratedInboxItem[] = [
  {
    title: "Draft PRD by Friday (from Q1 Planning)",
    body: "Alice was assigned to draft the PRD during Q1 planning.",
    type: "action_item",
    priority: "high",
    context_item_id: "ctx-1",
  },
  {
    title: "Review API spec (from Q1 Planning)",
    body: "Bob needs to review the API spec.",
    type: "action_item",
    priority: "high",
    context_item_id: "ctx-1",
  },
  {
    title: "Weekly sprint decision made",
    body: "Team decided to move to weekly sprints during Q1 planning.",
    type: "decision",
    priority: "normal",
    context_item_id: "ctx-1",
  },
  {
    title: "OVERDUE: Review design mockups",
    body: "This action item has been unread for over 48 hours.",
    type: "overdue",
    priority: "urgent",
    context_item_id: "ctx-old",
  },
  {
    title: "New deployment notification from Slack",
    body: "A deployment update was posted in Slack.",
    type: "new_context",
    priority: "low",
    context_item_id: "ctx-2",
  },
];

// --- Mock Supabase builder ---

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const selectChain = (data: unknown[] | null, error: Error | null = null) => ({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data, error }),
            }),
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data, error }),
              }),
            }),
            in: vi.fn().mockResolvedValue({ data: data, error }),
          }),
          lt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error }),
          }),
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
          in: vi.fn().mockResolvedValue({ data: data, error }),
        }),
        lt: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error }),
        }),
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
        in: vi.fn().mockResolvedValue({ data: data, error }),
      }),
    }),
  });

  const fromFn = vi.fn();
  return { from: fromFn, insert: insertFn, selectChain };
}

// --- Tests ---

describe("fetchRecentContextItems", () => {
  it("queries context_items with org_id, status=ready, and ingested_at >= since", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const mockData = SEED_CONTEXT_ITEMS;

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const results = await fetchRecentContextItems(supabase, "org-1", since);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("ctx-1");
    expect(supabase.from).toHaveBeenCalledWith("context_items");
  });

  it("returns empty array when no items found", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const results = await fetchRecentContextItems(supabase, "org-1", new Date().toISOString());
    expect(results).toEqual([]);
  });
});

describe("fetchOverdueActionItems", () => {
  it("queries unread action_items older than 48h", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: SEED_OVERDUE_ITEMS, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const results = await fetchOverdueActionItems(supabase, "org-1", "user-1");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Review design mockups");
  });
});

describe("fetchExistingInboxKeys", () => {
  it("returns empty set when no context item IDs provided", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = {} as any;
    const keys = await fetchExistingInboxKeys(supabase, "org-1", "user-1", []);
    expect(keys.size).toBe(0);
  });

  it("returns set of context_item_id:type keys", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { context_item_id: "ctx-1", type: "action_item" },
                  { context_item_id: "ctx-1", type: "decision" },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const keys = await fetchExistingInboxKeys(supabase, "org-1", "user-1", ["ctx-1"]);
    expect(keys.has("ctx-1:action_item")).toBe(true);
    expect(keys.has("ctx-1:decision")).toBe(true);
    expect(keys.has("ctx-2:action_item")).toBe(false);
  });
});

describe("generateInboxItemsAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no context or overdue items", async () => {
    const result = await generateInboxItemsAI([], []);
    expect(result).toEqual([]);
  });

  it("calls generateText with Output.array via gateway and returns items", async () => {
    const { generateText } = await import("ai");
    const { gateway } = await import("@ai-sdk/gateway");

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: AI_GENERATED_ITEMS,
    });

    const result = await generateInboxItemsAI(SEED_CONTEXT_ITEMS, SEED_OVERDUE_ITEMS);

    expect(result).toHaveLength(5);
    expect(result[0].type).toBe("action_item");
    expect(result[0].priority).toBe("high");
    expect(result[3].type).toBe("overdue");
    expect(result[3].priority).toBe("urgent");
    expect(result[4].type).toBe("new_context");
    expect(result[4].priority).toBe("low");

    // Verify AI gateway is used (not direct provider SDK)
    expect(gateway).toHaveBeenCalledWith("anthropic/claude-haiku-4-5-20251001");
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when AI returns null output", async () => {
    const { generateText } = await import("ai");
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: null });

    const result = await generateInboxItemsAI(SEED_CONTEXT_ITEMS, []);
    expect(result).toEqual([]);
  });
});

describe("generateInboxForUser (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates and inserts deduplicated inbox items", async () => {
    const { generateText } = await import("ai");
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: AI_GENERATED_ITEMS,
    });

    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "context_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: SEED_CONTEXT_ITEMS, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "inbox_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      lt: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                  // For fetchExistingInboxKeys
                  in: vi.fn().mockResolvedValue({
                    data: [
                      // ctx-1 action_item already exists — should be deduped
                      { context_item_id: "ctx-1", type: "action_item" },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
            insert: insertMock,
          };
        }
        return {};
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = await generateInboxForUser(supabase, "org-1", "user-1", since);

    // AI generated 5 items, but 2 have ctx-1:action_item which is deduped
    // Remaining: ctx-1:decision (1), ctx-old:overdue (1), ctx-2:new_context (1) = 3
    expect(count).toBe(3);
    expect(insertMock).toHaveBeenCalledTimes(1);

    const insertedRows = insertMock.mock.calls[0][0];
    expect(insertedRows).toHaveLength(3);

    // Verify all inserted rows have correct org/user
    for (const row of insertedRows) {
      expect(row.org_id).toBe("org-1");
      expect(row.user_id).toBe("user-1");
      expect(row.source_type).toBe("cron");
    }

    // Verify no action_item for ctx-1 was inserted (deduped)
    const actionItemsForCtx1 = insertedRows.filter(
      (r: { context_item_id: string; type: string }) =>
        r.context_item_id === "ctx-1" && r.type === "action_item"
    );
    expect(actionItemsForCtx1).toHaveLength(0);
  });

  it("returns 0 when no recent or overdue items exist", async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "context_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "inbox_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      lt: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const count = await generateInboxForUser(supabase, "org-1", "user-1", new Date().toISOString());
    expect(count).toBe(0);
  });

  it("returns 0 when AI generates items but all are duplicates", async () => {
    const { generateText } = await import("ai");
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: [AI_GENERATED_ITEMS[0]], // just one action_item for ctx-1
    });

    const insertMock = vi.fn();

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "context_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: SEED_CONTEXT_ITEMS, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "inbox_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      lt: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                  in: vi.fn().mockResolvedValue({
                    data: [{ context_item_id: "ctx-1", type: "action_item" }],
                    error: null,
                  }),
                }),
              }),
            }),
            insert: insertMock,
          };
        }
        return {};
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const count = await generateInboxForUser(supabase, "org-1", "user-1", new Date().toISOString());
    expect(count).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("truncates titles longer than 255 characters", async () => {
    const { generateText } = await import("ai");
    const longTitle = "A".repeat(300);
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: [{
        title: longTitle,
        body: "Test body",
        type: "new_context",
        priority: "low",
        context_item_id: "ctx-2",
      }],
    });

    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "context_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: SEED_CONTEXT_ITEMS, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "inbox_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      lt: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: insertMock,
          };
        }
        return {};
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const count = await generateInboxForUser(supabase, "org-1", "user-1", new Date().toISOString());
    expect(count).toBe(1);
    const insertedRows = insertMock.mock.calls[0][0];
    expect(insertedRows[0].title.length).toBe(255);
  });
});

describe("generateInboxItemsAI — categorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handles only overdue items (no recent context)", async () => {
    const { generateText } = await import("ai");
    const overdueResult: GeneratedInboxItem[] = [
      {
        title: "OVERDUE: Review design mockups",
        body: "Unread for over 48 hours.",
        type: "overdue",
        priority: "urgent",
        context_item_id: "ctx-old",
      },
    ];
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: overdueResult });

    const result = await generateInboxItemsAI([], SEED_OVERDUE_ITEMS);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("overdue");
    expect(result[0].priority).toBe("urgent");
  });

  it("handles only recent items (no overdue)", async () => {
    const { generateText } = await import("ai");
    const recentResult: GeneratedInboxItem[] = [
      {
        title: "New context item",
        body: "A new item appeared.",
        type: "new_context",
        priority: "low",
        context_item_id: "ctx-2",
      },
    ];
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: recentResult });

    const result = await generateInboxItemsAI(SEED_CONTEXT_ITEMS, []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("new_context");
  });
});
