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

import { GET, PATCH, DELETE } from "./route";
import { NextRequest } from "next/server";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAuthenticatedWithCanvas() {
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
    if (table === "canvases") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "c-1",
                  name: "Test",
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
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "c-1",
                    name: "Updated",
                    description: null,
                    viewport: { x: 0, y: 0, zoom: 1 },
                    settings: {},
                    updated_at: "2026-03-22",
                  },
                  error: null,
                }),
              }),
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
    if (table === "canvas_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    if (table === "canvas_connections") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    return {};
  });
}

describe("GET /api/canvases/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1");
    const res = await GET(req, makeParams("c-1"));
    expect(res.status).toBe(401);
  });

  it("returns canvas with items and connections", async () => {
    mockAuthenticatedWithCanvas();
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1");
    const res = await GET(req, makeParams("c-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("c-1");
    expect(body.items).toEqual([]);
    expect(body.connections).toEqual([]);
  });

  it("returns 404 for non-existent canvas", async () => {
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
    const req = new NextRequest("http://localhost:3000/api/canvases/nonexistent");
    const res = await GET(req, makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/canvases/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("c-1"));
    expect(res.status).toBe(401);
  });

  it("returns 200 when updating canvas", async () => {
    mockAuthenticatedWithCanvas();
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("c-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated");
  });
});

describe("DELETE /api/canvases/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("c-1"));
    expect(res.status).toBe(401);
  });

  it("returns 204 when deleting canvas", async () => {
    mockAuthenticatedWithCanvas();
    const req = new NextRequest("http://localhost:3000/api/canvases/c-1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("c-1"));
    expect(res.status).toBe(204);
  });
});
