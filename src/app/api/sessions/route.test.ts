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

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions", {
    method: "GET",
  });
}

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "s-1", name: "Test", goal: "Goal", status: "active", created_at: "2026-01-01", updated_at: "2026-01-01" },
          error: null,
        }),
      }),
    }),
  });
}

describe("GET /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(400);
  });

  it("returns 200 with sessions list", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await POST(makePostRequest({ name: "Test", goal: "Goal" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mockAuthenticatedUser();
    const res = await POST(makePostRequest({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 201 on success", async () => {
    mockAuthenticatedUser();
    const res = await POST(makePostRequest({ name: "Test Session", goal: "Research Q3" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test");
  });
});
