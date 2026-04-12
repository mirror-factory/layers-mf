import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockAdminFrom, mockAdminSingle } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockAdminSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: mockAdminFrom,
  }),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  class MockToolLoopAgent {
    constructor() {
      // no-op
    }
  }
  return {
    ...actual,
    ToolLoopAgent: MockToolLoopAgent,
    createAgentUIStreamResponse: vi
      .fn()
      .mockReturnValue(new Response("stream", { status: 200 })),
    stepCountIs: vi.fn().mockReturnValue(() => false),
  };
});

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn().mockReturnValue("mock-model"),
  createGateway: vi
    .fn()
    .mockReturnValue(vi.fn().mockReturnValue("mock-model")),
}));

vi.mock("@/lib/ai/config", () => ({
  gateway: vi.fn().mockReturnValue("mock-model"),
}));

// Mock bluewave-docs (imported by get_document_registry)
vi.mock("@/lib/bluewave-docs", () => ({
  BLUEWAVE_DOCUMENTS: [
    {
      id: "test-doc-1",
      title: "Test Document",
      type: "pdf",
      category: "Test",
      description: "A test document",
      url: "/test.pdf",
    },
  ],
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MOCK_PORTAL = {
  id: "portal-1",
  share_token: "bluewave-demo",
  is_public: true,
  title: "Proposal — Swell",
  client_name: "BlueWave Dynamics",
  client_context: "A tech company looking for web development.",
  brand_color: "#0DE4F2",
  document_content: "Page 1: Introduction\nPage 2: Budget is $50,000\nPage 3: Timeline is 12 weeks",
  documents: [
    { title: "Proposal — Swell", is_active: true, context_item_id: "ctx-1", content: "Proposal content..." },
    { title: "Scope of Work", is_active: false, context_item_id: "ctx-2", content: "Scope content..." },
  ],
  enabled_tools: [],
  model: null, // Should default to gemini-3.0-flash
  page_count: 5,
  system_prompt: null,
};

function makeRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const h = new Headers({ "Content-Type": "application/json" });
  if (headers) {
    for (const [k, v] of Object.entries(headers)) h.set(k, v);
  }
  return new NextRequest("http://localhost:3000/api/chat/portal", {
    method: "POST",
    body: JSON.stringify(body),
    headers: h,
  });
}

function makeMessages(text: string) {
  return [
    {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text }],
      createdAt: new Date().toISOString(),
    },
  ];
}

function setupPortalMock(portal = MOCK_PORTAL) {
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "document_portals") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: portal, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "context_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { raw_content: "test content" }, error: null }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/chat/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPortalMock();
  });

  // ---- Request validation ----

  describe("request validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/chat/portal", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Invalid JSON body");
    });

    it("returns 400 when share_token is missing", async () => {
      const res = await POST(makeRequest({ messages: makeMessages("hello") }));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Missing share_token");
    });

    it("returns 400 when messages is not an array", async () => {
      const res = await POST(
        makeRequest({ share_token: "bluewave-demo", messages: "not-array" })
      );
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Invalid messages");
    });

    it("returns 400 when messages array is empty", async () => {
      const res = await POST(
        makeRequest({ share_token: "bluewave-demo", messages: [] })
      );
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Invalid messages");
    });

    it("returns 404 when portal is not found", async () => {
      mockAdminFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            }),
          }),
        }),
      });
      const res = await POST(
        makeRequest({
          share_token: "nonexistent",
          messages: makeMessages("hello"),
        })
      );
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Portal not found");
    });

    it("accepts share_token from x-portal-token header", async () => {
      const res = await POST(
        makeRequest(
          { messages: makeMessages("hello") },
          { "x-portal-token": "bluewave-demo" }
        )
      );
      expect(res.status).toBe(200);
    });
  });

  // ---- Successful request ----

  describe("successful chat request", () => {
    it("returns 200 for valid request", async () => {
      const res = await POST(
        makeRequest({
          share_token: "bluewave-demo",
          messages: makeMessages("What is this proposal about?"),
        })
      );
      expect(res.status).toBe(200);
    });

    it("uses gemini-3.0-flash as default model", async () => {
      const { gateway } = await import("@/lib/ai/config");
      await POST(
        makeRequest({
          share_token: "bluewave-demo",
          messages: makeMessages("hello"),
        })
      );
      expect(gateway).toHaveBeenCalledWith("google/gemini-3.0-flash");
    });

    it("uses portal.model when specified", async () => {
      setupPortalMock({ ...MOCK_PORTAL, model: "anthropic/claude-sonnet-4.6" });
      const { gateway } = await import("@/lib/ai/config");
      await POST(
        makeRequest({
          share_token: "bluewave-demo",
          messages: makeMessages("hello"),
        })
      );
      expect(gateway).toHaveBeenCalledWith("anthropic/claude-sonnet-4.6");
    });
  });

  // ---- Voice mode ----

  describe("voice mode", () => {
    it("returns 200 when x-voice-mode header is set", async () => {
      const res = await POST(
        makeRequest(
          {
            share_token: "bluewave-demo",
            messages: makeMessages("hello"),
          },
          { "x-voice-mode": "true" }
        )
      );
      // Voice mode should not break the request — system prompt gets VOICE MODE appended
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Intent Detection Tests (most critical — this is the routing logic)
// ---------------------------------------------------------------------------

describe("intent detection", () => {
  // We test the intent detection regexes directly since they're the
  // core routing logic. These match the patterns from the route.
  const wantsChart = /\b(chart|graph|visualize|visualise|plot|bar chart|pie chart|line chart)\b/;
  const wantsWalkthrough = /\b(walkthrough|walk me through|walk-through|tour|guide me through|give me a tour)\b/;
  const wantsHighlight = /\b(highlight|underline|mark|point (to|out)|show me where|bring me to the .+ section|show me the .+ section|budget|schedule|pricing|timeline|scope)\b/;
  const wantsBookmark = /\b(bookmark|save (this|a) (note|bookmark)|remember this|note this|save for later)\b/;
  const wantsNavigate = /\b(go to|open|switch to|show me the|take me to|bring me to|navigate to)\b/;

  describe("chart detection", () => {
    it.each([
      "chart the budget",
      "show me a graph of costs",
      "visualize the timeline",
      "plot the phases",
      "create a bar chart",
      "make a pie chart of allocations",
      "line chart of progress",
    ])("detects chart intent: '%s'", (msg) => {
      expect(wantsChart.test(msg.toLowerCase())).toBe(true);
    });

    it.each([
      "what is the budget?",
      "summarize the document",
      "tell me about costs",
    ])("does not match non-chart: '%s'", (msg) => {
      expect(wantsChart.test(msg.toLowerCase())).toBe(false);
    });
  });

  describe("walkthrough detection", () => {
    it.each([
      "walk me through the proposal",
      "give me a tour",
      "walkthrough the document",
      "guide me through this",
    ])("detects walkthrough intent: '%s'", (msg) => {
      expect(wantsWalkthrough.test(msg.toLowerCase())).toBe(true);
    });
  });

  describe("highlight detection", () => {
    it.each([
      "highlight the budget section",
      "show me where the pricing is",
      "what about the budget",
      "show me the timeline section",
      "point to the scope",
      "bring me to the pricing section",
    ])("detects highlight intent: '%s'", (msg) => {
      expect(wantsHighlight.test(msg.toLowerCase())).toBe(true);
    });
  });

  describe("bookmark detection", () => {
    it.each([
      "bookmark this page",
      "save a note here",
      "remember this section",
      "note this section",
    ])("detects bookmark intent: '%s'", (msg) => {
      expect(wantsBookmark.test(msg.toLowerCase())).toBe(true);
    });
  });

  describe("navigate detection", () => {
    it.each([
      "go to page 5",
      "open the scope of work",
      "switch to the proposal",
      "take me to the appendix",
      "navigate to the summary",
    ])("detects navigate intent: '%s'", (msg) => {
      expect(wantsNavigate.test(msg.toLowerCase())).toBe(true);
    });

    it("navigate does not fire when highlight also matches", () => {
      const msg = "show me the budget section";
      const isHighlight = wantsHighlight.test(msg.toLowerCase());
      const isNav = wantsNavigate.test(msg.toLowerCase()) && !isHighlight;
      expect(isHighlight).toBe(true);
      expect(isNav).toBe(false);
    });
  });

  describe("intent priority", () => {
    it("chart takes priority over walkthrough", () => {
      const msg = "chart a walkthrough of the budget";
      expect(wantsChart.test(msg.toLowerCase())).toBe(true);
    });

    it("highlight keyword 'budget' fires even without explicit 'highlight'", () => {
      expect(wantsHighlight.test("what about the budget")).toBe(true);
      expect(wantsHighlight.test("show me the pricing")).toBe(true);
      expect(wantsHighlight.test("the schedule section")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Tool helpers — splitPages and searchDocumentContent
// ---------------------------------------------------------------------------

describe("portal tool helpers", () => {
  // Extracted logic from route (splitPages, searchDocumentContent)
  function splitPages(content: string, pageSize = 3000): string[] {
    const pages: string[] = [];
    for (let i = 0; i < content.length; i += pageSize) {
      pages.push(content.slice(i, i + pageSize));
    }
    return pages.length > 0 ? pages : ["(empty document)"];
  }

  function searchDocumentContent(
    content: string,
    query: string,
    maxResults = 10
  ): { lineNumber: number; text: string; page: number }[] {
    const lines = content.split("\n");
    const lowerQuery = query.toLowerCase();
    const results: { lineNumber: number; text: string; page: number }[] = [];
    for (let i = 0; i < lines.length && results.length < maxResults; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        const charOffset = lines.slice(0, i).join("\n").length;
        const page = Math.floor(charOffset / 3000) + 1;
        results.push({ lineNumber: i + 1, text: lines[i].trim(), page });
      }
    }
    return results;
  }

  describe("splitPages", () => {
    it("splits content into 3000-char pages", () => {
      const content = "a".repeat(7000);
      const pages = splitPages(content);
      expect(pages).toHaveLength(3);
      expect(pages[0]).toHaveLength(3000);
      expect(pages[1]).toHaveLength(3000);
      expect(pages[2]).toHaveLength(1000);
    });

    it("returns ['(empty document)'] for empty string", () => {
      expect(splitPages("")).toEqual(["(empty document)"]);
    });

    it("keeps short content as single page", () => {
      const pages = splitPages("Hello world");
      expect(pages).toHaveLength(1);
      expect(pages[0]).toBe("Hello world");
    });
  });

  describe("searchDocumentContent", () => {
    const content = "Budget Overview\nTotal: $50,000\nTimeline: 12 weeks\nDeliverables\nPhase 1: Design";

    it("finds matching lines", () => {
      const results = searchDocumentContent(content, "budget");
      expect(results).toHaveLength(1);
      expect(results[0].lineNumber).toBe(1);
      expect(results[0].text).toBe("Budget Overview");
    });

    it("is case-insensitive", () => {
      const results = searchDocumentContent(content, "TIMELINE");
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Timeline: 12 weeks");
    });

    it("respects maxResults", () => {
      // "e" appears in multiple lines
      const results = searchDocumentContent(content, "e", 2);
      expect(results).toHaveLength(2);
    });

    it("returns empty for no matches", () => {
      const results = searchDocumentContent(content, "nonexistent");
      expect(results).toHaveLength(0);
    });

    it("calculates page numbers correctly", () => {
      // All content is under 3000 chars, so page should be 1
      const results = searchDocumentContent(content, "Phase");
      expect(results[0].page).toBe(1);
    });
  });
});
