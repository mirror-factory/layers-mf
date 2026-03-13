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

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/conversations", { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/conversations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function setupAuth(orgId = "org-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
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

describe("GET /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org membership", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockNoOrg());
    const res = await GET();
    expect(res.status).toBe(400);
  });

  it("returns list of conversations", async () => {
    setupAuth();
    const convData = [
      { id: "c-1", title: "First", created_at: "2026-03-08T10:00:00Z", updated_at: "2026-03-08T10:00:00Z" },
      { id: "c-2", title: null, created_at: "2026-03-09T10:00:00Z", updated_at: "2026-03-09T10:00:00Z" },
    ];

    const convBuilder: Record<string, unknown> = {};
    const chainFn = vi.fn().mockReturnValue(convBuilder);
    convBuilder.select = chainFn;
    convBuilder.eq = chainFn;
    convBuilder.order = chainFn;
    convBuilder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ data: convData, error: null }).then(resolve, reject);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "conversations") return convBuilder;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("c-1");
  });

  it("returns empty array when no conversations exist", async () => {
    setupAuth();
    const convBuilder: Record<string, unknown> = {};
    const chainFn = vi.fn().mockReturnValue(convBuilder);
    convBuilder.select = chainFn;
    convBuilder.eq = chainFn;
    convBuilder.order = chainFn;
    convBuilder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "conversations") return convBuilder;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    setupAuth();
    const convBuilder: Record<string, unknown> = {};
    const chainFn = vi.fn().mockReturnValue(convBuilder);
    convBuilder.select = chainFn;
    convBuilder.eq = chainFn;
    convBuilder.order = chainFn;
    convBuilder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "DB failure" } }).then(resolve, reject);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "conversations") return convBuilder;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB failure");
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await POST(makePostRequest({ title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org membership", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockNoOrg());
    const res = await POST(makePostRequest({ title: "Test" }));
    expect(res.status).toBe(400);
  });

  it("creates a conversation with title", async () => {
    setupAuth();
    const convRecord = {
      id: "c-new",
      title: "My Chat",
      created_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T10:00:00Z",
    };

    mockFrom.mockReturnValue(mockOrgMember());
    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: convRecord, error: null }),
        }),
      }),
    });

    const res = await POST(makePostRequest({ title: "My Chat" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("c-new");
    expect(body.title).toBe("My Chat");
  });

  it("creates a conversation without title (null title)", async () => {
    setupAuth();
    const convRecord = {
      id: "c-new",
      title: null,
      created_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T10:00:00Z",
    };

    mockFrom.mockReturnValue(mockOrgMember());
    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: convRecord, error: null }),
        }),
      }),
    });

    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBeNull();
  });

  it("returns 500 on insert error", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());
    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
        }),
      }),
    });

    const res = await POST(makePostRequest({ title: "Fail" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Insert failed");
  });
});
