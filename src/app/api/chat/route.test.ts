import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock fns are available inside hoisted vi.mock factories
const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: vi.fn(),
  }),
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

vi.mock("@/lib/ai/tools", () => ({
  createTools: vi.fn().mockReturnValue({
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

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

    const res = await POST(makeRequest({ messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }] }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 400 when user has no organization", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }] }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("returns 400 when messages array is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid messages");
  });

  it("falls back to default model when unknown model is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const { gateway } = await import("@ai-sdk/gateway");

    const res = await POST(
      makeRequest({
        model: "unknown/model",
        messages: [{ role: "user", parts: [{ type: "text", text: "test" }] }],
      })
    );

    expect(res.status).toBe(200);
    expect(gateway).toHaveBeenCalledWith("anthropic/claude-haiku-4-5-20251001");
  });

  it("uses the requested model when it is in the allowlist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const { gateway } = await import("@ai-sdk/gateway");

    await POST(
      makeRequest({
        model: "openai/gpt-4o",
        messages: [{ role: "user", parts: [{ type: "text", text: "test" }] }],
      })
    );

    expect(gateway).toHaveBeenCalledWith("openai/gpt-4o");
  });

  it("returns 200 streaming response for valid request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({
        messages: [{ role: "user", parts: [{ type: "text", text: "What happened in Q3?" }] }],
      })
    );

    expect(res.status).toBe(200);
  });
});
