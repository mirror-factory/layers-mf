import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminFrom, mockListUsers } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockListUsers: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    auth: { admin: { listUsers: mockListUsers } },
  })),
}));

import { GET, PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/members", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/members", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const OWNER_UUID = "f47ac10b-58cc-4372-a567-0d02b2c3d479";
const OTHER_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

function mockOwner() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: OWNER_UUID, email: "owner@test.com" } },
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

describe("GET /api/team/members", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with members list", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: OWNER_UUID, email: "owner@test.com" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, val: string) => {
          if (val === OWNER_UUID) {
            return {
              single: vi.fn().mockResolvedValue({
                data: { org_id: "org-1", role: "owner" },
              }),
            };
          }
          // For org_id eq
          return {
            data: [{ id: "m-1", user_id: OWNER_UUID, role: "owner" }],
            error: null,
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-1", role: "owner" },
            }),
          };
        }),
      }),
    });
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: OWNER_UUID, email: "owner@test.com" }] },
    });
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/team/members", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await PATCH(makePatchRequest({ userId: "u-2", role: "admin" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockNonOwner();
    const res = await PATCH(makePatchRequest({ userId: "u-2", role: "admin" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when changing own role", async () => {
    mockOwner();
    const res = await PATCH(makePatchRequest({ userId: OWNER_UUID, role: "member" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot change your own role");
  });

  it("returns 200 on successful role change", async () => {
    mockOwner();
    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    const res = await PATCH(
      makePatchRequest({ userId: OTHER_UUID, role: "admin" })
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/team/members", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await DELETE(makeDeleteRequest({ userId: "u-2" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockNonOwner();
    const res = await DELETE(
      makeDeleteRequest({ userId: OTHER_UUID })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when removing self", async () => {
    mockOwner();
    const res = await DELETE(makeDeleteRequest({ userId: OWNER_UUID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot remove yourself");
  });

  it("returns 200 on successful removal", async () => {
    mockOwner();
    mockAdminFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    const res = await DELETE(
      makeDeleteRequest({ userId: OTHER_UUID })
    );
    expect(res.status).toBe(200);
  });
});
