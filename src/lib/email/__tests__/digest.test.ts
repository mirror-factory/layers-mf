import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock helpers ----

/** Creates a fluent chain mock that returns itself for all query methods */
function mockChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "data") return data;
      if (prop === "error") return error;
      if (prop === "then") return undefined; // prevent Promise detection
      // Terminal methods return the result directly
      if (prop === "single") return vi.fn().mockReturnValue(result);
      if (prop === "limit") return vi.fn().mockReturnValue(result);
      // All other methods return self for continued chaining
      return vi.fn().mockReturnValue(self);
    },
  });
  return self;
}

function createMockSupabase(
  contextItems: unknown[] = [],
  inboxItems: unknown[] = [],
  overdueItems: unknown[] = [],
  profile: unknown = { full_name: "Alfonso", email: "alfonso@test.com" }
) {
  let callCount = 0;
  const chains = [
    mockChain(contextItems),   // context_items
    mockChain(inboxItems),     // inbox_items (unread, recent)
    mockChain(overdueItems),   // inbox_items (overdue)
    mockChain(profile),        // profiles
  ];

  return {
    from: vi.fn(() => {
      const chain = chains[callCount] ?? mockChain([]);
      callCount++;
      return chain;
    }),
  };
}

// ---- Tests ----

import { generateDigestForUser } from "../digest";
import { renderDigestHTML } from "../digest-template";
import type { DigestData } from "../digest";

describe("generateDigestForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no items exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createMockSupabase([], [], []) as any;
    const result = await generateDigestForUser(supabase, "user-1", "org-1");
    expect(result).toBeNull();
  });

  it("returns digest data with new context items", async () => {
    const contextItems = [
      {
        id: "ctx-1",
        title: "Weekly standup notes",
        source_type: "google_drive",
        content_type: "document",
      },
      {
        id: "ctx-2",
        title: "Q1 Revenue Report",
        source_type: "upload",
        content_type: "pdf",
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createMockSupabase(contextItems, [], []) as any;
    const result = await generateDigestForUser(supabase, "user-1", "org-1");

    expect(result).not.toBeNull();
    expect(result!.userName).toBe("Alfonso");
    expect(result!.newContextCount).toBe(2);
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].type).toBe("new_context");
    expect(result!.overdueActions).toHaveLength(0);
  });

  it("includes overdue action items", async () => {
    const overdueItems = [
      {
        id: "inbox-1",
        title: "Review PR #42",
        context_item_id: "ctx-10",
        created_at: "2026-03-14T10:00:00Z",
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createMockSupabase([], [], overdueItems) as any;
    const result = await generateDigestForUser(supabase, "user-1", "org-1");

    expect(result).not.toBeNull();
    expect(result!.overdueActions).toHaveLength(1);
    expect(result!.overdueActions[0].priority).toBe("urgent");
    expect(result!.overdueActions[0].title).toBe("Review PR #42");
  });

  it("falls back to email when full_name is missing", async () => {
    const contextItems = [
      { id: "ctx-1", title: "Test", source_type: "upload", content_type: "pdf" },
    ];
    const supabase = createMockSupabase(
      contextItems,
      [],
      [],
      { full_name: null, email: "test@example.com" }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
    const result = await generateDigestForUser(supabase, "user-1", "org-1");
    expect(result!.userName).toBe("test@example.com");
  });
});

describe("renderDigestHTML", () => {
  const baseData: DigestData = {
    userName: "Alfonso",
    date: "Monday, March 17, 2026",
    newContextCount: 3,
    items: [
      {
        title: "New meeting notes uploaded",
        type: "new_context",
        source: "google_drive/document",
        priority: "normal",
        url: "http://localhost:3000/context/ctx-1",
      },
      {
        title: "Approve budget proposal",
        type: "action_item",
        source: "inbox",
        priority: "high",
        url: "http://localhost:3000/inbox",
      },
      {
        title: "Switched to Postgres 16",
        type: "decision",
        source: "inbox",
        priority: "normal",
        url: "http://localhost:3000/inbox",
      },
    ],
    overdueActions: [],
  };

  it("produces valid HTML with user name and date", () => {
    const html = renderDigestHTML(baseData);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Good morning, Alfonso");
    expect(html).toContain("Monday, March 17, 2026");
    expect(html).toContain("3 new items in your knowledge base");
  });

  it("includes action items when present", () => {
    const html = renderDigestHTML(baseData);

    expect(html).toContain("Approve budget proposal");
    expect(html).toContain("Action items needing attention");
  });

  it("includes decisions section", () => {
    const html = renderDigestHTML(baseData);

    expect(html).toContain("Key decisions");
    expect(html).toContain("Switched to Postgres 16");
  });

  it("includes overdue actions with urgent styling", () => {
    const data: DigestData = {
      ...baseData,
      overdueActions: [
        {
          title: "Review PR #42",
          type: "action_item",
          source: "overdue",
          priority: "urgent",
          url: "http://localhost:3000/context/ctx-10",
        },
      ],
    };
    const html = renderDigestHTML(data);

    expect(html).toContain("Review PR #42");
    expect(html).toContain("1 overdue action");
    expect(html).toContain("#dc2626"); // urgent color
  });

  it("includes unsubscribe/manage preferences link", () => {
    const html = renderDigestHTML(baseData);

    expect(html).toContain("/settings/notifications");
    expect(html).toContain("Manage notification preferences");
    expect(html).toContain("Unsubscribe from digest");
  });

  it("escapes HTML in user-provided content", () => {
    const data: DigestData = {
      ...baseData,
      userName: '<script>alert("xss")</script>',
      items: [
        {
          title: 'Item with <b>HTML</b> & "quotes"',
          type: "new_context",
          source: "test",
          priority: "normal",
          url: "http://localhost:3000/test",
        },
      ],
    };
    const html = renderDigestHTML(data);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;HTML&lt;/b&gt;");
    expect(html).toContain("&amp; &quot;quotes&quot;");
  });
});
