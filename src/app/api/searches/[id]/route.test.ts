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

import { DELETE } from "./route";
import { NextRequest } from "next/server";

function makeDeleteRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/searches/${id}`, {
    method: "DELETE",
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe("DELETE /api/searches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const [req, ctx] = makeDeleteRequest("s-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("removes a saved search", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "saved_searches") {
        let callCount = 0;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "s-1", user_id: "u-1" },
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    const [req, ctx] = makeDeleteRequest("s-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it("returns 403 for other user's search", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "saved_searches") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "s-2", user_id: "u-other" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const [req, ctx] = makeDeleteRequest("s-2");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when search not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "saved_searches") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }
      return {};
    });

    const [req, ctx] = makeDeleteRequest("s-nonexistent");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });
});
