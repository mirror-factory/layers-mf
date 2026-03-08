import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(url = "http://localhost:3000/api/chat/history"): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

const mockRows = [
  {
    id: "msg-1",
    role: "user",
    content: [{ type: "text", text: "Hello" }],
    model: null,
    created_at: "2026-03-08T10:00:00Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content: [{ type: "text", text: "Hi there!" }],
    model: "anthropic/claude-haiku-4-5-20251001",
    created_at: "2026-03-08T10:00:05Z",
  },
];

// Creates a chainable query builder mock that resolves to the given result
function createQueryBuilder(
  result: { data: unknown; error: { message: string } | null } = { data: mockRows, error: null }
) {
  // Every chained method returns the same builder, final await resolves to result
  const builder: Record<string, unknown> = {};
  const chainFn = vi.fn().mockReturnValue(builder);
  builder.select = chainFn;
  builder.eq = chainFn;
  builder.is = chainFn;
  builder.order = chainFn;
  builder.limit = chainFn;
  builder.single = vi.fn().mockResolvedValue(result);
  // Make the builder thenable so `await query` resolves
  builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function setupAuthenticatedUser(orgId = "org-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
}

describe("GET /api/chat/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 400 when user has no organization", async () => {
    setupAuthenticatedUser();
    const orgBuilder = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(orgBuilder);

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("returns messages in UIMessage format for global chat", async () => {
    setupAuthenticatedUser();
    const orgBuilder = createQueryBuilder({ data: null, error: null });
    orgBuilder.single = vi.fn().mockResolvedValue({ data: { org_id: "org-1" } });

    const chatBuilder = createQueryBuilder({ data: mockRows, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return orgBuilder;
      if (table === "chat_messages") return chatBuilder;
      return {};
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text: "Hello" }],
    });
    expect(body[1]).toMatchObject({
      id: "msg-2",
      role: "assistant",
      parts: [{ type: "text", text: "Hi there!" }],
    });
  });

  it("returns empty array when no messages exist", async () => {
    setupAuthenticatedUser();
    const orgBuilder = createQueryBuilder({ data: null, error: null });
    orgBuilder.single = vi.fn().mockResolvedValue({ data: { org_id: "org-1" } });

    const chatBuilder = createQueryBuilder({ data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return orgBuilder;
      if (table === "chat_messages") return chatBuilder;
      return {};
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("queries with session_id filter when provided", async () => {
    setupAuthenticatedUser();
    const orgBuilder = createQueryBuilder({ data: null, error: null });
    orgBuilder.single = vi.fn().mockResolvedValue({ data: { org_id: "org-1" } });

    const chatBuilder = createQueryBuilder({ data: mockRows, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return orgBuilder;
      if (table === "chat_messages") return chatBuilder;
      return {};
    });

    const res = await GET(makeRequest("http://localhost:3000/api/chat/history?session_id=sess-1"));
    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("chat_messages");
  });

  it("returns 500 on database error", async () => {
    setupAuthenticatedUser();
    const orgBuilder = createQueryBuilder({ data: null, error: null });
    orgBuilder.single = vi.fn().mockResolvedValue({ data: { org_id: "org-1" } });

    const chatBuilder = createQueryBuilder({ data: null, error: { message: "DB error" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return orgBuilder;
      if (table === "chat_messages") return chatBuilder;
      return {};
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });
});
