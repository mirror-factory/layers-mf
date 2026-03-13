import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockExtract, mockEmbed, mockCreateInbox, mockFetchDriveChanges, mockNangoProxy } =
  vi.hoisted(() => ({
    mockAdminFrom: vi.fn(),
    mockExtract: vi.fn(),
    mockEmbed: vi.fn(),
    mockCreateInbox: vi.fn(),
    mockFetchDriveChanges: vi.fn(),
    mockNangoProxy: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
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

vi.mock("@/lib/integrations/google-drive", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchDriveChanges: mockFetchDriveChanges,
  };
});

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: mockNangoProxy },
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/google-drive", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({}),
  });
}

function mockIntegrationLookup(options?: {
  channelId?: string;
  startPageToken?: string;
}) {
  const channelId = options?.channelId ?? "channel-1";
  const startPageToken = options?.startPageToken ?? "token-1";

  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: [
            {
              id: "int-1",
              org_id: "org-1",
              nango_connection_id: "conn-1",
              provider: "google-drive",
              sync_config: {
                watch: { channelId },
                startPageToken,
              },
            },
          ],
          single: vi.fn().mockResolvedValue({
            data: {
              sync_config: {
                watch: { channelId },
                startPageToken,
              },
            },
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-1" }, error: null }),
      }),
    }),
  });
}

function mockDbForFileProcessing() {
  const selectMock = vi.fn();

  // For integration lookup (returns array via .data)
  const eqChain = {
    eq: vi.fn().mockReturnValue({
      data: [
        {
          id: "int-1",
          org_id: "org-1",
          nango_connection_id: "conn-1",
          provider: "google-drive",
          sync_config: {
            watch: { channelId: "channel-1" },
            startPageToken: "token-1",
          },
        },
      ],
      single: vi.fn().mockResolvedValue({
        data: {
          sync_config: {
            watch: { channelId: "channel-1" },
            startPageToken: "token-1",
          },
        },
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  };

  selectMock.mockReturnValue({
    eq: vi.fn().mockReturnValue(eqChain),
  });

  mockAdminFrom.mockReturnValue({
    select: selectMock,
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-1" }, error: null }),
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
    entities: {},
  });
  mockEmbed.mockResolvedValue([0.1, 0.2]);
  mockCreateInbox.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/google-drive", () => {
  it("returns 400 when Google Drive headers are missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing Google Drive headers");
  });

  it("returns 400 when x-goog-channel-id is missing", async () => {
    const res = await POST(
      makeRequest({ "x-goog-resource-state": "change" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when x-goog-resource-state is missing", async () => {
    const res = await POST(
      makeRequest({ "x-goog-channel-id": "channel-1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 for sync (initial verification) ping", async () => {
    const res = await POST(
      makeRequest({
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-state": "sync",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns 200 for non-change resource states (e.g., update)", async () => {
    const res = await POST(
      makeRequest({
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-state": "update",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns 404 when no integration matches the channel ID", async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({
        "x-goog-channel-id": "unknown-channel",
        "x-goog-resource-state": "change",
        "x-goog-resource-id": "res-1",
      })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unknown channel");
  });

  it("returns 500 when no startPageToken is found", async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [
              {
                id: "int-1",
                org_id: "org-1",
                nango_connection_id: "conn-1",
                provider: "google-drive",
                sync_config: {
                  watch: { channelId: "channel-1" },
                  // no startPageToken
                },
              },
            ],
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-state": "change",
        "x-goog-resource-id": "res-1",
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("No page token");
  });

  it("returns 200 with channel info for valid change event", async () => {
    mockDbForFileProcessing();
    mockFetchDriveChanges.mockResolvedValue({
      files: [],
      newStartPageToken: "token-2",
    });

    const res = await POST(
      makeRequest({
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-state": "change",
        "x-goog-resource-id": "res-1",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.channelId).toBe("channel-1");
    expect(body.resourceState).toBe("change");
  });
});
