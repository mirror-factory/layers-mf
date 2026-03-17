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

/** Read all SSE events from a streaming response and return the parsed events */
async function readSSE(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

/** Read SSE and return the last event (usually the "complete" event) */
async function readSSEResult(res: Response): Promise<Record<string, unknown>> {
  const events = await readSSE(res);
  return events[events.length - 1] ?? {};
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

  it("returns error event for unknown provider", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    const res = await POST(makeRequest({ connectionId: "c-1", provider: "notion" }));
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    const errorEvent = events.find((e) => e.phase === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.message).toContain("No fetch strategy");
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
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);

    // Verify Nango was called with correct Slack endpoints
    expect(mockNangoProxy).toHaveBeenCalledTimes(2);
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/conversations.list",
        params: { types: "public_channel", limit: "20" },
      })
    );
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/conversations.history",
        params: { channel: "C123", limit: "200" },
      })
    );
  });

  it("returns processed=0 when channels fetch fails", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockNangoProxy.mockRejectedValueOnce(new Error("Slack API error"));

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
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
    const body = await readSSEResult(res);
    expect(body.processed).toBe(0);
  });

  it("limits to 20 channels even when more are returned", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    const channels = Array.from({ length: 25 }, (_, i) => ({
      id: `C${i}`,
      name: `channel-${i}`,
    }));

    const longMsg = "A".repeat(60);

    mockNangoProxy.mockResolvedValueOnce({ data: { channels } });
    // Only 20 channels should be fetched
    for (let i = 0; i < 20; i++) {
      mockNangoProxy.mockResolvedValueOnce({
        data: { messages: [{ ts: "1", text: longMsg }] },
      });
    }

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "slack" }));
    expect(res.status).toBe(200);
    await readSSEResult(res); // consume full stream
    // 1 call for conversations.list + 20 for conversations.history
    expect(mockNangoProxy).toHaveBeenCalledTimes(21);
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
    await readSSEResult(res); // consume stream before checking mocks

    // Verify insert was called with correct source_type and content_type
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: "slack",
        content_type: "message",
        source_id: expect.stringContaining("slack-C999-"),
        title: expect.stringContaining("#eng — recent messages"),
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
    const body = await readSSEResult(res);
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
    const body = await readSSEResult(res);
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
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);
  });
});

describe("POST /api/integrations/sync — Granola", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches meeting transcripts via Nango proxy", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        documents: [
          {
            id: "mtg-1",
            title: "Sprint Planning",
            transcript: "This is a sufficiently long transcript from the sprint planning meeting to pass the fifty character minimum filter.",
            created_at: "2026-03-01T10:00:00Z",
            attendees: [
              { name: "Alice", email: "alice@co.com" },
              { name: "Bob", email: "bob@co.com" },
            ],
          },
        ],
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "granola" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);

    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/v1/documents",
        providerConfigKey: "granola",
      })
    );
  });

  it("returns processed=0 when documents fetch fails", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockNangoProxy.mockRejectedValueOnce(new Error("Granola API error"));

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "granola" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.processed).toBe(0);
  });

  it("skips documents with short transcripts", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        documents: [
          { id: "mtg-2", title: "Quick call", transcript: "Short" },
        ],
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "granola" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.processed).toBe(0);
  });

  it("creates context_item with content_type=meeting_transcript and includes attendees", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    const transcript = "A".repeat(100);
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        documents: [
          {
            id: "mtg-3",
            title: "Retro",
            transcript,
            attendees: [{ name: "Carol" }, { name: "Dan" }],
          },
        ],
      },
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-g1" }, error: null }),
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
      title: "Retro meeting",
      description_short: "Retro",
      description_long: "Detailed retro",
      entities: { people: ["Carol", "Dan"] },
    });
    mockEmbed.mockResolvedValue([0.5]);
    mockCreateInbox.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "granola" }));
    expect(res.status).toBe(200);
    await readSSEResult(res); // consume stream before checking mocks

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: "granola",
        content_type: "meeting_transcript",
        source_id: "mtg-3",
      })
    );

    // Verify content includes attendees
    const insertedContent = insertMock.mock.calls[0][0].raw_content as string;
    expect(insertedContent).toContain("Attendees: Carol, Dan");
  });

  it("handles array-style response data", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    // Some APIs return data as a flat array
    mockNangoProxy.mockResolvedValueOnce({
      data: [
        {
          id: "mtg-flat",
          title: "Team Sync",
          transcript: "A long enough transcript for the team sync meeting that passes the minimum character filter.",
          created_at: "2026-03-02T14:00:00Z",
        },
      ],
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "granola" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
  });
});

describe("POST /api/integrations/sync — Linear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches issues with all fields via Nango proxy", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        issues: [
          {
            id: "issue-1",
            identifier: "ENG-42",
            title: "Fix login bug",
            description: "Users cannot log in when using SSO. The OAuth redirect is broken and needs to be fixed urgently.",
            state: { name: "In Progress" },
            assignee: { name: "Alice" },
            priority: 1,
            labels: { nodes: [{ name: "bug" }, { name: "auth" }] },
            createdAt: "2026-03-01T09:00:00Z",
          },
        ],
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
    expect(body.processed).toBe(1);

    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/issues",
        providerConfigKey: "linear",
      })
    );
  });

  it("returns processed=0 when issues fetch fails", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockNangoProxy.mockRejectedValueOnce(new Error("Linear API error"));

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.processed).toBe(0);
  });

  it("skips issues with short descriptions", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        issues: [
          { id: "issue-2", title: "Minor", description: "short" },
        ],
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.processed).toBe(0);
  });

  it("creates context_item with all issue metadata in content", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        issues: [
          {
            id: "issue-3",
            identifier: "PROD-99",
            title: "Add dark mode",
            description: "Implement dark mode support across all pages and components in the application.",
            state: { name: "Todo" },
            assignee: { name: "Bob" },
            priority: 3,
            labels: { nodes: [{ name: "feature" }, { name: "ui" }] },
            createdAt: "2026-02-28",
          },
        ],
      },
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-l1" }, error: null }),
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
      title: "PROD-99: Add dark mode",
      description_short: "Dark mode feature",
      description_long: "Full dark mode implementation",
      entities: { people: ["Bob"] },
    });
    mockEmbed.mockResolvedValue([0.2]);
    mockCreateInbox.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    await readSSEResult(res); // consume stream before checking mocks

    // Verify insert was called with correct source_type and content_type
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: "linear",
        content_type: "issue",
        source_id: "issue-3",
        title: "PROD-99: Add dark mode",
      })
    );

    // Verify content includes metadata
    const insertedContent = insertMock.mock.calls[0][0].raw_content as string;
    expect(insertedContent).toContain("Status: Todo");
    expect(insertedContent).toContain("Assignee: Bob");
    expect(insertedContent).toContain("Priority: Medium");
    expect(insertedContent).toContain("Labels: feature, ui");
    expect(insertedContent).toContain("ID: PROD-99");
  });

  it("formats title with identifier prefix when available", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        issues: [
          {
            id: "issue-4",
            identifier: "ENG-100",
            title: "Refactor auth",
            description: "Refactor the authentication module to use the new auth library and improve security.",
          },
        ],
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
  });

  it("handles GraphQL-style nested response data", async () => {
    mockAuthenticatedUser();
    mockIntegrationLookup();
    mockAdminDbForProcessing();

    mockNangoProxy.mockResolvedValueOnce({
      data: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-gql",
                identifier: "API-5",
                title: "API rate limiting",
                description: "Add rate limiting to all API endpoints to prevent abuse and ensure fair usage.",
                state: { name: "Backlog" },
                createdAt: "2026-03-05",
              },
            ],
          },
        },
      },
    });

    const res = await POST(makeRequest({ connectionId: "c-1", provider: "linear" }));
    expect(res.status).toBe(200);
    const body = await readSSEResult(res);
    expect(body.fetched).toBe(1);
  });
});
