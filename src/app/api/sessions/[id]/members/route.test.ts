import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminListUsers } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAdminListUsers: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { listUsers: mockAdminListUsers } },
  }),
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

const mockParams = Promise.resolve({ id: "sess-1" });

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions/sess-1/members", { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions/sess-1/members", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuthenticatedWithSession() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { org_id: "org-1", user_id: "u-1" } }),
            }),
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
              single: vi.fn().mockResolvedValue({ data: { id: "sess-1" } }),
            }),
          }),
        }),
      };
    }
    if (table === "session_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "sm-1", user_id: "u-1", role: "member", joined_at: "2026-03-09T00:00:00Z" }],
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "sm-2", user_id: "u-2", role: "member", joined_at: "2026-03-09T01:00:00Z" },
              error: null,
            }),
          }),
        }),
      };
    }
    return {};
  });
}

describe("GET /api/sessions/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await GET(makeGetRequest(), { params: mockParams });
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
      if (table === "sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(makeGetRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("returns members list with emails", async () => {
    mockAuthenticatedWithSession();
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: "u-1", email: "alice@test.com" }] },
    });

    const res = await GET(makeGetRequest(), { params: mockParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].user_id).toBe("u-1");
    expect(body[0].email).toBe("alice@test.com");
  });
});

describe("POST /api/sessions/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await POST(makePostRequest({ user_id: "u-2" }), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid user_id", async () => {
    mockAuthenticatedWithSession();
    const res = await POST(makePostRequest({ user_id: "not-a-uuid" }), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("returns 201 when member added successfully", async () => {
    mockAuthenticatedWithSession();
    const res = await POST(
      makePostRequest({ user_id: "f47ac10b-58cc-4372-a567-0d02b2c3d479" }),
      { params: mockParams },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("sm-2");
    expect(body.role).toBe("member");
  });
});
