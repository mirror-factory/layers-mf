import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockAdminFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
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

import { DELETE } from "./route";
import { NextRequest } from "next/server";

function makeDeleteRequest(id: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/team/invite/${id}`,
    { method: "DELETE" }
  );
}

const OWNER_UUID = "f47ac10b-58cc-4372-a567-0d02b2c3d479";

function mockOwner() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: OWNER_UUID, email: "owner@test.com" } },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { org_id: "org-1", role: "owner" },
        }),
      }),
    }),
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

function mockNoOrg() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-no-org", email: "noorg@test.com" } },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  });
}

describe("DELETE /api/team/invite/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await DELETE(makeDeleteRequest("inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has no organization", async () => {
    mockNoOrg();
    const res = await DELETE(makeDeleteRequest("inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-owner", async () => {
    mockNonOwner();
    const res = await DELETE(makeDeleteRequest("inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 204 on successful revocation", async () => {
    mockOwner();
    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });
    const res = await DELETE(makeDeleteRequest("inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(res.status).toBe(204);
  });

  it("returns 500 when admin update fails", async () => {
    mockOwner();
    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: "DB error" },
            }),
          }),
        }),
      }),
    });
    const res = await DELETE(makeDeleteRequest("inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });
});
