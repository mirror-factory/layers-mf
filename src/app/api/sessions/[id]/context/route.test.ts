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

describe("POST /api/sessions/[id]/context — edge cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when context_item_id is not a UUID", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "not-a-uuid" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when context_item_id is missing", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
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
    const req = new NextRequest("http://localhost:3000/api/sessions/s-nonexistent/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when context item already linked", async () => {
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
                data: null,
                error: { code: "23505", message: "duplicate key" },
              }),
            }),
          }),
        };
      }
      return {};
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already linked");
  });

  it("returns 500 when insert fails with non-duplicate error", async () => {
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
                data: null,
                error: { code: "23503", message: "foreign key violation" },
              }),
            }),
          }),
        };
      }
      return {};
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(500);
  });

  it("returns 400 when no org for POST", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "POST",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("s-1"));
    expect(res.status).toBe(400);
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

  it("returns 401 when unauthenticated for DELETE", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "DELETE",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req, makeParams("s-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when context_item_id is invalid for DELETE", async () => {
    mockAuthWithSession();
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "DELETE",
      body: JSON.stringify({ context_item_id: "bad-id" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req, makeParams("s-1"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when delete fails", async () => {
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
      if (table === "session_context_links") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
            }),
          }),
        };
      }
      return {};
    });
    const req = new NextRequest("http://localhost:3000/api/sessions/s-1/context", {
      method: "DELETE",
      body: JSON.stringify({ context_item_id: "550e8400-e29b-41d4-a716-446655440000" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req, makeParams("s-1"));
    expect(res.status).toBe(500);
  });
});
