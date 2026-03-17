import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminInsert } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAdminInsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: mockAdminInsert,
    }),
  }),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat/feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuthenticatedUser(userId = "u-1", orgId = "org-1") {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { org_id: orgId } }),
      }),
    }),
  });
}

describe("POST /api/chat/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminInsert.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        feedback: "positive",
      })
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 400 when messageId is missing", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        feedback: "positive",
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("messageId is required");
  });

  it("returns 400 when feedback is missing", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("feedback must be 'positive' or 'negative'");
  });

  it("returns 400 when feedback is not 'positive' or 'negative'", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        feedback: "neutral",
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("feedback must be 'positive' or 'negative'");
  });

  it("stores feedback in audit_log on success", async () => {
    mockAuthenticatedUser("u-1", "org-1");

    const { createAdminClient } = await import("@/lib/supabase/server");
    const adminDb = createAdminClient();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        conversationId: "conv-1",
        feedback: "negative",
        reason: "wrong_answer",
      })
    );

    expect(res.status).toBe(200);
    expect(mockAdminInsert).toHaveBeenCalledWith({
      org_id: "org-1",
      user_id: "u-1",
      action: "chat_feedback",
      resource_type: "chat_message",
      resource_id: "msg-1",
      metadata: {
        feedback: "negative",
        reason: "wrong_answer",
        conversationId: "conv-1",
      },
    });
  });

  it("returns 200 with { success: true }", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        feedback: "positive",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  it("returns 400 for invalid reason", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        feedback: "negative",
        reason: "bad_vibes",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid reason");
  });

  it("accepts positive feedback without a reason", async () => {
    mockAuthenticatedUser();

    const res = await POST(
      makeRequest({
        messageId: "msg-1",
        feedback: "positive",
      })
    );

    expect(res.status).toBe(200);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          feedback: "positive",
          reason: null,
        }),
      })
    );
  });
});
