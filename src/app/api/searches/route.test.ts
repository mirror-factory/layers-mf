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

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/searches", {
    method: "GET",
  });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/searches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAuthenticatedUser(userId = "u-1", orgId = "org-1") {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  return { userId, orgId };
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

function mockNoOrgMember() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  };
}

describe("GET /api/searches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns user's saved searches", async () => {
    mockAuthenticatedUser();

    const ownSearches = [
      { id: "s-1", name: "Pricing", query: "pricing", filters: {}, is_shared: false, created_at: "2026-03-17" },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "saved_searches") {
        // Return a chainable mock that handles both own and shared queries
        let callCount = 0;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 2) {
                // First chain: own searches (user_id eq + order)
                return {
                  order: vi.fn().mockResolvedValue({ data: ownSearches, error: null }),
                  single: vi.fn().mockResolvedValue({ data: null }),
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                };
              }
              // Shared searches chain
              return {
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.searches).toBeDefined();
    expect(Array.isArray(body.searches)).toBe(true);
  });

  it("includes shared searches from the org", async () => {
    mockAuthenticatedUser();

    const ownSearches = [
      { id: "s-1", name: "My Search", query: "mine", filters: {}, is_shared: false, created_at: "2026-03-17" },
    ];
    const sharedSearches = [
      { id: "s-2", name: "Team Search", query: "team", filters: {}, is_shared: true, created_at: "2026-03-16" },
    ];

    let savedSearchCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "saved_searches") {
        savedSearchCallCount++;
        if (savedSearchCallCount === 1) {
          // Own searches: .select().eq("user_id").order()
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: ownSearches, error: null }),
              }),
            }),
          };
        }
        // Shared searches: .select().eq("org_id").eq("is_shared").neq("user_id").order()
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: sharedSearches, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.searches.length).toBe(2);
    expect(body.searches[0].name).toBe("My Search");
    expect(body.searches[1].name).toBe("Team Search");
  });
});

describe("POST /api/searches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const res = await POST(makePostRequest({ name: "Test", query: "test" }));
    expect(res.status).toBe(401);
  });

  it("creates a saved search", async () => {
    mockAuthenticatedUser();

    const createdSearch = {
      id: "s-new",
      name: "Pricing decisions",
      query: "pricing decision",
      filters: { source_type: "linear" },
      is_shared: false,
      created_at: "2026-03-17",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "saved_searches") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: createdSearch, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(
      makePostRequest({
        name: "Pricing decisions",
        query: "pricing decision",
        filters: { source_type: "linear" },
        is_shared: false,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Pricing decisions");
    expect(body.query).toBe("pricing decision");
  });

  it("returns 400 when name is missing", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      return {};
    });

    const res = await POST(makePostRequest({ query: "test" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name and query are required");
  });

  it("returns 400 when query is missing", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      return {};
    });

    const res = await POST(makePostRequest({ name: "Test" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name and query are required");
  });
});
