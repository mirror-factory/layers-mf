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

describe("GET /api/sessions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(401);
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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
            }),
          }),
        }),
      };
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1");
    const res = await GET(req, makeParams("s-1"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/sessions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("s-1"));
    expect(res.status).toBe(400);
  });
});
