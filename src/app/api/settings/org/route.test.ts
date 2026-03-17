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

import { GET, PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/settings/org", {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

const mockUser = { id: "u-1", email: "owner@test.com" };

function mockMemberQuery(orgId: string | null, role = "owner") {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      orgId
        ? { data: { org_id: orgId, role }, error: null }
        : { data: null, error: { message: "Not found" } }
    ),
  };
}

function mockOrgSelect(org: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: org,
          error: org ? null : { message: "Not found" },
        }),
      }),
    }),
  };
}

function mockCountQuery(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ count, error: null }),
    }),
  };
}

function mockUpdateQuery(success: boolean) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: success ? null : { message: "Update failed" },
      }),
    }),
  };
}

function mockDeleteQuery(success: boolean) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: success ? null : { message: "Delete failed" },
      }),
    }),
  };
}

describe("GET /api/settings/org", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns org details for owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const orgChain = mockOrgSelect({
      id: "org-1",
      name: "Mirror Factory",
      created_at: "2026-03-05T00:00:00Z",
    });
    const membersCount = mockCountQuery(3);
    const contextCount = mockCountQuery(482);
    const integrationCount = mockCountQuery(6);

    let orgCallCount = 0;
    let membersCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") {
        membersCallCount++;
        if (membersCallCount === 1) return memberChain;
        return membersCount;
      }
      if (table === "organizations") return orgChain;
      if (table === "context_items") return contextCount;
      if (table === "integrations") return integrationCount;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("org-1");
    expect(body.name).toBe("Mirror Factory");
    expect(body.member_count).toBe(3);
    expect(body.context_item_count).toBe(482);
    expect(body.integration_count).toBe(6);
  });

  it("returns 403 for non-admin/owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "member");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/settings/org", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await PATCH(makeRequest("PATCH", { name: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("updates org name for owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const updateChain = mockUpdateQuery(true);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "organizations") return updateChain;
      return {};
    });

    const res = await PATCH(makeRequest("PATCH", { name: "New Org Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 403 for non-owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "admin");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await PATCH(makeRequest("PATCH", { name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("validates name length", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await PATCH(makeRequest("PATCH", { name: "A" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/settings/org", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await DELETE(makeRequest("DELETE", { confirm: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("requires confirm body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { confirm: "WRONG" }));
    expect(res.status).toBe(400);
  });

  it("deletes org for owner with correct confirm", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const deleteChain = mockDeleteQuery(true);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "organizations") return deleteChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { confirm: "DELETE" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 403 for non-owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "member");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { confirm: "DELETE" }));
    expect(res.status).toBe(403);
  });
});
