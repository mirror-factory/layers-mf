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
  return new NextRequest("http://localhost:3000/api/canvases", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
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
          data: {
            id: "c-1",
            name: "Test Canvas",
            description: null,
            viewport: { x: 0, y: 0, zoom: 1 },
            settings: {},
            created_by: "u-1",
            created_at: "2026-03-22",
            updated_at: "2026-03-22",
          },
          error: null,
        }),
      }),
    }),
  });
}

describe("GET /api/canvases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with canvases list", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
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
});

describe("POST /api/canvases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const res = await POST(makePostRequest({ name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 201 on success", async () => {
    mockAuthenticatedUser();
    const res = await POST(makePostRequest({ name: "Test Canvas" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test Canvas");
  });

  it("returns 400 for invalid body", async () => {
    mockAuthenticatedUser();
    const res = await POST(makePostRequest({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    mockAuthenticatedUser();
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });
});
