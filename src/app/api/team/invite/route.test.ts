import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminFrom, mockInviteUserByEmail, mockListUsers } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockAdminFrom: vi.fn(),
    mockInviteUserByEmail: vi.fn(),
    mockListUsers: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    auth: {
      admin: {
        inviteUserByEmail: mockInviteUserByEmail,
        listUsers: mockListUsers,
      },
    },
  })),
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockOwner(email = "owner@test.com") {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-owner", email } },
    error: null,
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-1", role: "owner" },
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };
    }
    if (table === "org_invitations") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

function mockNonOwner() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-member", email: "member@test.com" } },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { org_id: "org-1", role: "member" },
        }),
      }),
    }),
  });
}

describe("GET /api/team/invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockNonOwner();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with invitations list", async () => {
    mockOwner();
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/team/invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await POST(makePostRequest({ email: "test@test.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockNonOwner();
    const res = await POST(makePostRequest({ email: "test@test.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid email", async () => {
    mockOwner();
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    const res = await POST(makePostRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for self-invite", async () => {
    mockOwner("owner@test.com");
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    const res = await POST(makePostRequest({ email: "owner@test.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot invite yourself");
  });

  it("returns 409 when user is already a member", async () => {
    mockOwner();
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "u-existing", email: "existing@test.com" }] },
    });
    // Override org_members mock to return existing member for the target user
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              if (val === "u-owner") {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: { org_id: "org-1", role: "owner" },
                  }),
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "m-existing" },
                    }),
                  }),
                };
              }
              return {
                single: vi.fn().mockResolvedValue({
                  data: { org_id: "org-1", role: "owner" },
                }),
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "m-existing" },
                  }),
                }),
              };
            }),
          }),
        };
      }
      return {};
    });
    const res = await POST(makePostRequest({ email: "existing@test.com" }));
    expect(res.status).toBe(409);
  });

  it("returns 201 on successful invite", async () => {
    mockOwner();
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    mockAdminFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "inv-1",
              email: "new@test.com",
              role: "member",
              status: "pending",
              created_at: "2026-03-08",
              expires_at: "2026-03-15",
            },
            error: null,
          }),
        }),
      }),
    });
    mockInviteUserByEmail.mockResolvedValue({ data: {}, error: null });
    const res = await POST(makePostRequest({ email: "new@test.com", role: "member" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("new@test.com");
  });
});
