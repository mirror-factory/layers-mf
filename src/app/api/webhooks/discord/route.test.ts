import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockExtract, mockEmbed, mockCreateInbox, mockVerifyDiscordSignature } =
  vi.hoisted(() => ({
    mockAdminFrom: vi.fn(),
    mockExtract: vi.fn(),
    mockEmbed: vi.fn(),
    mockCreateInbox: vi.fn(),
    mockVerifyDiscordSignature: vi.fn(),
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

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: vi.fn() },
}));

vi.mock("@/lib/webhook-dedup", () => ({
  claimWebhookEvent: vi.fn().mockResolvedValue(true),
  completeWebhookEvent: vi.fn().mockResolvedValue(undefined),
  hashPayload: vi.fn().mockReturnValue("mock-hash"),
}));

vi.mock("@/lib/integrations/discord", () => ({
  verifyDiscordSignature: mockVerifyDiscordSignature,
  batchMessagesToContent: vi.fn(),
  buildMessageMetadata: vi.fn().mockReturnValue({
    channelId: "ch-1",
    guildId: null,
    authorId: "u-1",
    authorName: "test",
    threadId: null,
  }),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  body: unknown,
  options?: { signature?: string; timestamp?: string }
): NextRequest {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options?.signature) headers["x-signature-ed25519"] = options.signature;
  if (options?.timestamp) headers["x-signature-timestamp"] = options.timestamp;

  return new NextRequest("http://localhost:3000/api/webhooks/discord", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

const VALID_SIG = "validsig";
const VALID_TS = "1234567890";

function mockDbForProcessing() {
  const selectChain = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-1", nango_connection_id: "conn-1", sync_config: {} },
            }),
          }),
        }),
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { org_id: "org-1", nango_connection_id: "conn-1", sync_config: {} },
          }),
        }),
      }),
    }),
  };

  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue(selectChain),
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
  vi.stubEnv("DISCORD_PUBLIC_KEY", "abcd1234");
  mockVerifyDiscordSignature.mockResolvedValue(true);
});

describe("POST /api/webhooks/discord", () => {
  it("returns 500 when DISCORD_PUBLIC_KEY is not configured", async () => {
    vi.stubEnv("DISCORD_PUBLIC_KEY", "");
    const res = await POST(
      makeRequest({ type: 1 }, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Webhook not configured");
  });

  it("returns 401 when signature verification fails", async () => {
    mockVerifyDiscordSignature.mockResolvedValue(false);
    const res = await POST(
      makeRequest({ type: 1 }, { signature: "badsig", timestamp: VALID_TS })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns 400 for invalid JSON body", async () => {
    const invalidBody = "not-json{";
    const req = new NextRequest("http://localhost:3000/api/webhooks/discord", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": VALID_SIG,
        "x-signature-timestamp": VALID_TS,
      },
      body: invalidBody,
    });
    // verifyDiscordSignature is called with the raw body, mock it to pass
    mockVerifyDiscordSignature.mockResolvedValue(true);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("responds with PONG (type 1) for PING interaction", async () => {
    const res = await POST(
      makeRequest({ type: 1 }, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe(1);
  });

  it("returns { received: true } for gateway event without type/data", async () => {
    const res = await POST(
      makeRequest({ type: 0 }, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns { received: true } for MESSAGE_CREATE event", async () => {
    mockDbForProcessing();
    const event = {
      type: 0,
      t: "MESSAGE_CREATE",
      d: {
        id: "msg-1",
        channel_id: "ch-1",
        guild_id: "guild-1",
        content: "This is a sufficiently long message to pass the minimum length filter check.",
        timestamp: "2026-03-01T10:00:00Z",
        author: {
          id: "user-1",
          username: "testuser",
          global_name: "Test User",
          bot: false,
        },
      },
    };
    const res = await POST(
      makeRequest(event, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns { received: true } for THREAD_CREATE event", async () => {
    mockDbForProcessing();
    const event = {
      type: 0,
      t: "THREAD_CREATE",
      d: {
        id: "thread-1",
        name: "New Discussion Thread",
        guild_id: "guild-1",
        parent_id: "ch-1",
        owner_id: "user-1",
        type: 11,
      },
    };
    const res = await POST(
      makeRequest(event, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns { received: true } for unhandled event types", async () => {
    const event = {
      type: 0,
      t: "GUILD_MEMBER_ADD",
      d: { user: { id: "u-1" } },
    };
    const res = await POST(
      makeRequest(event, { signature: VALID_SIG, timestamp: VALID_TS })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
