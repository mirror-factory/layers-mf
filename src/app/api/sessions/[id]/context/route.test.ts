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

import { POST, DELETE } from "./route";
import { NextRequest } from "next/server";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

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
    if (table === "session_context_links") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "link-1", session_id: "s-1", context_item_id: "ci-1" },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

describe("POST /api/sessions/[id]/context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "ci-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns 201 when linking context", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/sessions/[id]/context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 when unlinking context", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "DELETE",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req, makeParams("s-1"));
    expect(res.status).toBe(204);
  });
});
