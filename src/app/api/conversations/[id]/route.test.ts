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
  createAdminClient: vi.fn().mockReturnValue({
    from: mockAdminFrom,
  }),
}));

import { GET, DELETE } from "./route";
import { NextRequest } from "next/server";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeGetRequest(id = "c-1"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${id}`, { method: "GET" });
}

function makeDeleteRequest(id = "c-1"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${id}`, { method: "DELETE" });
}

function mockOrgMember(orgId = "org-1") {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { org_id: orgId } }),
      }),
    }),
  };
}

function mockNoOrg() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  };
}

function setupAuth() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
}

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await GET(makeGetRequest(), makeParams("c-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org membership", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockNoOrg());
    const res = await GET(makeGetRequest(), makeParams("c-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversation not found", async () => {
    setupAuth();
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      };
    });

    const res = await GET(makeGetRequest("c-nonexistent"), makeParams("c-nonexistent"));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Conversation not found");
  });

  it("returns conversation data when found", async () => {
    setupAuth();
    const convData = {
      id: "c-1",
      title: "My Convo",
      created_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T10:00:00Z",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: convData, error: null }),
            }),
          }),
        }),
      };
    });

    const res = await GET(makeGetRequest("c-1"), makeParams("c-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("c-1");
    expect(body.title).toBe("My Convo");
  });
});

describe("DELETE /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await DELETE(makeDeleteRequest(), makeParams("c-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org membership", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockNoOrg());
    const res = await DELETE(makeDeleteRequest(), makeParams("c-1"));
    expect(res.status).toBe(400);
  });

  it("returns 204 on successful delete", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    const deleteBuilder: Record<string, unknown> = {};
    const chainFn = vi.fn().mockReturnValue(deleteBuilder);
    deleteBuilder.delete = chainFn;
    deleteBuilder.eq = chainFn;
    deleteBuilder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve, reject);

    mockAdminFrom.mockReturnValue(deleteBuilder);

    const res = await DELETE(makeDeleteRequest("c-1"), makeParams("c-1"));
    expect(res.status).toBe(204);
  });

  it("returns 500 on delete error", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    const deleteBuilder: Record<string, unknown> = {};
    const chainFn = vi.fn().mockReturnValue(deleteBuilder);
    deleteBuilder.delete = chainFn;
    deleteBuilder.eq = chainFn;
    deleteBuilder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ error: { message: "Delete failed" } }).then(resolve, reject);

    mockAdminFrom.mockReturnValue(deleteBuilder);

    const res = await DELETE(makeDeleteRequest("c-1"), makeParams("c-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Delete failed");
  });
});
