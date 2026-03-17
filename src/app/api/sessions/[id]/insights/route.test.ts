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

import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleInsights = [
  {
    id: "ins-1",
    insight_type: "cross_source_connection",
    title: "Meeting decision conflicts with Linear issue",
    description: "The pricing decision contradicts PROD-145.",
    severity: "important",
    source_item_ids: ["item-1", "item-2"],
    related_item_ids: [],
    status: "active",
    dismissed_by: null,
    dismissed_at: null,
    created_at: "2026-03-17T10:00:00Z",
    metadata: {},
  },
];

function mockAuthWithSession() {
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
              single: vi.fn().mockResolvedValue({ data: { id: "s-1" } }),
            }),
          }),
        }),
      };
    }
    if (table === "session_insights") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: sampleInsights, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "ins-1", insight_type: "cross_source_connection", title: "Test", status: "dismissed", dismissed_by: "u-1", dismissed_at: "2026-03-17T12:00:00Z" },
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
}

describe("GET /api/sessions/[id]/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns insights for a session", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insights).toHaveLength(1);
    expect(body.insights[0].insight_type).toBe("cross_source_connection");
    expect(body.insights[0].title).toBe("Meeting decision conflicts with Linear issue");
  });

  it("filters by status query param", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights?status=all");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insights).toBeDefined();
  });

  it("returns 400 when user has no org", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(400);
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
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/sessions/[id]/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights", {
      method: "PATCH",
      body: JSON.stringify({ insightId: "550e8400-e29b-41d4-a716-446655440000", status: "dismissed" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("updates insight status", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights", {
      method: "PATCH",
      body: JSON.stringify({ insightId: "550e8400-e29b-41d4-a716-446655440000", status: "dismissed" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("dismissed");
    expect(body.dismissed_by).toBe("u-1");
  });

  it("returns 400 for invalid body", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights", {
      method: "PATCH",
      body: JSON.stringify({ insightId: "not-a-uuid", status: "dismissed" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights", {
      method: "PATCH",
      body: JSON.stringify({ insightId: "550e8400-e29b-41d4-a716-446655440000", status: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when insight not found", async () => {
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
      if (table === "session_insights") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/insights", {
      method: "PATCH",
      body: JSON.stringify({ insightId: "550e8400-e29b-41d4-a716-446655440000", status: "pinned" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(404);
  });
});
