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

import { POST, GET } from "./route";
import { NextRequest } from "next/server";

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/interactions", { method: "GET" });
}

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
}

function mockOrgMember() {
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
    if (table === "user_interactions") {
      return {
        insert: vi.fn().mockReturnValue({
          then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
            cb({ error: null });
            return { catch: vi.fn() };
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

describe("POST /api/interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const res = await POST(makePostRequest({ type: "click" }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 400 when user has no organization", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await POST(makePostRequest({ type: "click" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("validates interaction_type", async () => {
    mockAuthenticatedUser();
    mockOrgMember();

    const res = await POST(makePostRequest({ type: "invalid_type" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid interaction_type");
  });

  it("creates an interaction successfully", async () => {
    mockAuthenticatedUser();
    const insertMock = vi.fn().mockReturnValue({
      then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
        cb({ error: null });
        return { catch: vi.fn() };
      }),
    });

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
      if (table === "user_interactions") {
        return { insert: insertMock };
      }
      return {};
    });

    const res = await POST(
      makePostRequest({
        type: "click",
        resourceType: "context_item",
        resourceId: "00000000-0000-0000-0000-000000000001",
        sourceType: "linear",
        contentType: "issue",
        metadata: { position: 3, fromPage: "/context" },
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        user_id: "u-1",
        interaction_type: "click",
        resource_type: "context_item",
        source_type: "linear",
        content_type: "issue",
      }),
    );
  });

  it("creates a search interaction", async () => {
    mockAuthenticatedUser();
    const insertMock = vi.fn().mockReturnValue({
      then: vi.fn().mockImplementation((cb: (result: { error: null }) => void) => {
        cb({ error: null });
        return { catch: vi.fn() };
      }),
    });

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
      if (table === "user_interactions") {
        return { insert: insertMock };
      }
      return {};
    });

    const res = await POST(
      makePostRequest({
        type: "search",
        query: "pricing decisions",
        metadata: { resultCount: 5, page: "/context" },
      }),
    );

    expect(res.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction_type: "search",
        query: "pricing decisions",
      }),
    );
  });
});

describe("GET /api/interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns interactions and summary for user", async () => {
    mockAuthenticatedUser();

    const mockInteractions = [
      {
        id: "i-1",
        interaction_type: "search",
        query: "pricing strategy",
        source_type: "linear",
        created_at: new Date().toISOString(),
      },
      {
        id: "i-2",
        interaction_type: "click",
        source_type: "linear",
        created_at: new Date().toISOString(),
      },
      {
        id: "i-3",
        interaction_type: "click",
        source_type: "gdrive",
        created_at: new Date().toISOString(),
      },
    ];

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
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: mockInteractions,
                      error: null,
                    }),
                  }),
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

    expect(body.interactions).toHaveLength(3);
    expect(body.summary.totalSearches).toBe(1);
    expect(body.summary.totalClicks).toBe(2);
    expect(body.summary.topSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "linear", count: 2 }),
      ]),
    );
    expect(body.summary.topTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topic: "pricing" }),
        expect.objectContaining({ topic: "strategy" }),
      ]),
    );
  });
});
