import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminFrom, mockNangoProxy, mockExtract, mockEmbed, mockCreateInbox } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockAdminFrom: vi.fn(),
    mockNangoProxy: vi.fn(),
    mockExtract: vi.fn(),
    mockEmbed: vi.fn(),
    mockCreateInbox: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: mockNangoProxy },
}));

vi.mock("@/lib/ai/extract", () => ({
  extractStructured: mockExtract,
}));

vi.mock("@/lib/ai/embed", () => ({
  generateEmbedding: mockEmbed,
}));

vi.mock("@/lib/inbox", () => ({
  createInboxItems: mockCreateInbox,
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/integrations/sync", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-1" } },
    error: null,
  });
}

function mockIntegrationLookup(orgId = "org-1") {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { org_id: orgId },
        }),
      }),
    }),
  });
}

function mockAdminDbForProcessing() {
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "ci-1" },
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  mockExtract.mockResolvedValue({
    title: "Extracted title",
    description_short: "Short desc",
    description_long: "Long desc",
    entities: { people: [] },
  });
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
  mockCreateInbox.mockResolvedValue(undefined);
}

describe("POST /api/integrations/sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when connectionId or provider missing", async () => {
    mockAuthenticatedUser();
    const res = await POST(makeRequest({ connectionId: "c-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when integration not found", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for unknown provider", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    const res = await POST(makeRequest({ connectionId: "c-1", provider: "notion" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No fetch strategy");
  });
});

describe("POST /api/integrations/sync — Slack", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches channels and messages via Nango proxy", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    // conversations.list → 1 channel, conversations.history → messages
    mockNangoProxy
      .mockResolvedValueOnce({
        data: {
          channels: [{ id: "C123", name: "general" }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          messages: [
            { ts: "1", text: "This is a long enough message to pass the filter easily here" },
            { ts: "2", text: "Another message that is also long enough to pass filtering" },
          ],
        },
      });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);

    // Verify Nango was called with correct Slack endpoints
    expect(mockNangoProxy).toHaveBeenCalledTimes(2);
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/conversations.list",
        params: { types: "public_channel", limit: "10" },
      })
    );
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/conversations.history",
        params: { channel: "C123", limit: "50" },
      })
    );
  });

  it("returns processed=0 when channels fetch fails", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockNangoProxy.mockRejectedValueOnce(new Error("Slack API error"));

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });

  it("skips channels with too-short messages", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    mockNangoProxy
      .mockResolvedValueOnce({
        data: { channels: [{ id: "C1", name: "empty-chan" }] },
      })
      .mockResolvedValueOnce({
        data: { messages: [{ ts: "1", text: "short" }] },
      });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });

  it("limits to 3 channels even when more are returned", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    const channels = Array.from({ length: 6 }, (_, i) => ({
      id: `C${i}`,
      name: `channel-${i}`,
    }));

    const longMsg = "A".repeat(60);

    mockNangoProxy.mockResolvedValueOnce({ data: { channels } });
    // Only 3 channels should be fetched
    for (let i = 0; i < 3; i++) {
      mockNangoProxy.mockResolvedValueOnce({
        data: { messages: [{ ts: "1", text: longMsg }] },
      });
    }

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    // 1 call for conversations.list + 3 for conversations.history
    expect(mockNangoProxy).toHaveBeenCalledTimes(4);
  });

  it("creates context_item with source_type=slack and content_type=message", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    const longMsg = "This message is definitely long enough to pass the twenty character filter";
    mockNangoProxy
      .mockResolvedValueOnce({
        data: { channels: [{ id: "C999", name: "eng" }] },
      })
      .mockResolvedValueOnce({
        data: { messages: [{ ts: "1", text: longMsg }] },
      });

    // Track the insert call
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-new" }, error: null }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      }),
      insert: insertMock,
      update: updateMock,
    });

    mockExtract.mockResolvedValue({
      title: "#eng messages",
      description_short: "Short",
      description_long: "Long",
      entities: {},
    });
    mockEmbed.mockResolvedValue([0.1]);
    mockCreateInbox.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);

    // Verify insert was called with correct source_type and content_type
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: "slack",
        content_type: "message",
        source_id: "slack-C999",
        title: "#eng — recent messages",
      })
    );
  });

  it("handles conversation.history failure gracefully", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    mockNangoProxy
      .mockResolvedValueOnce({
        data: { channels: [{ id: "C1", name: "private" }] },
      })
      .mockRejectedValueOnce(new Error("not_in_channel"));

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });
});

describe("POST /api/integrations/sync — GitHub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches repos and issues via Nango proxy", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy
      .mockResolvedValueOnce({
        data: [{ full_name: "org/repo", name: "repo" }],
      })
      .mockResolvedValueOnce({
        data: [
          { number: 1, title: "Bug fix", body: "A long enough body for testing purposes here", created_at: "2026-01-01" },
        ],
      });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "github" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);
  });
});

describe("POST /api/integrations/sync — Google Drive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches and exports Google Docs via Nango proxy", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy
      .mockResolvedValueOnce({
        data: {
          files: [{
            id: "doc-1",
            name: "Meeting Notes",
            mimeType: "application/vnd.google-apps.document",
            createdTime: "2026-01-01",
          }],
        },
      })
      .mockResolvedValueOnce({
        data: "These are the detailed meeting notes from the team sync on Monday morning discussing project timelines.",
      });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "google-drive" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);
  });
});
