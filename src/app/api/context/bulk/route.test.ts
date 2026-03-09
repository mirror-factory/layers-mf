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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/context/bulk", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/context/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const res = await DELETE(makeRequest({ ids: ["1"] }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 400 when user has no organization", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await DELETE(makeRequest({ ids: ["1"] }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("returns 400 when ids is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const res = await DELETE(makeRequest({ ids: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ids must be a non-empty array");
  });

  it("returns 400 when ids is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
        }),
      }),
    });

    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ids must be a non-empty array");
  });

  it("deletes items and returns count", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });

    const deletedItems = [{ id: "ci-1" }, { id: "ci-2" }];

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
      if (table === "context_items") {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: deletedItems, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await DELETE(makeRequest({ ids: ["ci-1", "ci-2"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(2);
  });

  it("returns 500 on database error", async () => {
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
      if (table === "context_items") {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await DELETE(makeRequest({ ids: ["ci-1"] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });
});
