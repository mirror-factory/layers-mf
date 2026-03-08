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
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

vi.mock("@/lib/ai/session-tools", () => ({
  createSessionTools: vi.fn().mockReturnValue({
    search_context: { description: "mock", execute: vi.fn() },
    get_document: { description: "mock", execute: vi.fn() },
  }),
}));

vi.mock("ai", () => {
  class MockToolLoopAgent {
    constructor() {
      // no-op
    }
  }
  return {
    ToolLoopAgent: MockToolLoopAgent,
    createAgentUIStreamResponse: vi.fn().mockReturnValue(new Response("stream", { status: 200 })),
    stepCountIs: vi.fn().mockReturnValue(() => false),
    UIMessage: vi.fn(),
  };
});

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn().mockReturnValue("mock-model"),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat/session/s-1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuthWithSession() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
          }),
        }),
      };
    }
    if (table === "sessions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "s-1", name: "Test Session", goal: "Research Q3" },
              }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

describe("POST /api/chat/session/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await POST(
      makeRequest({ messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }] }),
      makeParams("s-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when session not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };
    });
    const res = await POST(
      makeRequest({ messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }] }),
      makeParams("s-1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when messages empty", async () => {
    mockAuthWithSession();
    const res = await POST(makeRequest({ messages: [] }), makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 200 streaming response for valid request", async () => {
    mockAuthWithSession();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "What happened?" }] }],
      }),
      makeParams("s-1")
    );
    expect(res.status).toBe(200);
  });
});
