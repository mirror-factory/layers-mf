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

vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

const USER_ID = "d4e5f6a7-b8c9-4d0e-af1f-2a3b4c5d6e7f";
const ORG_ID = "e5f6a7b8-c9d0-4e1f-a2a3-b4c5d6e7f8a9";

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/sharing");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/sharing", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function setupAuth() {
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
}

function mockOrgMember(orgId = ORG_ID) {
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

// --- GET tests ---

describe("GET /api/sharing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns shares for authenticated user", async () => {
    setupAuth();

    // Mock org_members lookup
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      return {};
    });

    // Mock admin queries for conversations, context items, and skills
    const chainBuilder = () => {
      const builder: Record<string, unknown> = {};
      const chainFn = vi.fn().mockReturnValue(builder);
      builder.select = chainFn;
      builder.eq = chainFn;
      builder.neq = chainFn;
      builder.in = chainFn;
      builder.or = vi.fn().mockResolvedValue({ data: [] });
      builder.order = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [] }),
      });
      builder.limit = vi.fn().mockResolvedValue({ data: [] });
      return builder;
    };

    mockAdminFrom.mockImplementation(() => chainBuilder());

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("conversations");
    expect(body).toHaveProperty("context");
    expect(body).toHaveProperty("skills");
  });
});

// --- POST tests ---

describe("POST /api/sharing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No auth" } });
    const res = await POST(
      makePostRequest({
        resource_type: "artifact",
        resource_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        scope: "org",
        permission: "view",
      })
    );
    expect(res.status).toBe(401);
  });

  it("creates a share with resource_type schema and correct fields", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    const shareRecord = {
      id: "share-1",
      resource_type: "artifact",
      resource_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      shared_with_user_id: null,
      scope: "org",
      permission: "view",
      shared_by: USER_ID,
      org_id: ORG_ID,
      created_at: "2026-04-15T00:00:00Z",
    };

    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: shareRecord, error: null }),
        }),
      }),
    });

    const res = await POST(
      makePostRequest({
        resource_type: "artifact",
        resource_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        scope: "org",
        permission: "view",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.share).toBeDefined();
    expect(body.share.resource_type).toBe("artifact");
    expect(body.share.scope).toBe("org");
    expect(body.share.permission).toBe("view");
    expect(body.share.shared_by).toBe(USER_ID);
  });

  it("returns 400 for missing required fields", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    // Body missing resource_type and resource_id — neither schema will match
    const res = await POST(
      makePostRequest({
        scope: "org",
        permission: "view",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when scope is user but shared_with_user_id is missing", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    const res = await POST(
      makePostRequest({
        resource_type: "conversation",
        resource_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        scope: "user",
        permission: "edit",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("shared_with_user_id");
  });

  it("returns 400 when sharing with yourself", async () => {
    setupAuth();
    mockFrom.mockReturnValue(mockOrgMember());

    const res = await POST(
      makePostRequest({
        resource_type: "context_item",
        resource_id: "c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f",
        shared_with_user_id: USER_ID,
        scope: "user",
        permission: "view",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("yourself");
  });
});
