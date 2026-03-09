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

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/context/ci-1", { method: "GET" });
}

const mockParams = Promise.resolve({ id: "ci-1" });

describe("GET /api/context/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const res = await GET(makeRequest(), { params: mockParams });
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

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("returns 404 when item does not exist", async () => {
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
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns full context item on success", async () => {
    const mockItem = {
      id: "ci-1",
      title: "Q3 Report",
      description_short: "Summary",
      description_long: "Full summary",
      source_type: "upload",
      source_id: null,
      content_type: "document",
      raw_content: "Full content here",
      entities: { people: ["Alice"], topics: ["finance"], action_items: [], decisions: [] },
      status: "ready",
      ingested_at: "2026-03-01T00:00:00Z",
      processed_at: "2026-03-01T00:01:00Z",
    };

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
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("ci-1");
    expect(body.title).toBe("Q3 Report");
    expect(body.raw_content).toBe("Full content here");
    expect(body.entities.people).toEqual(["Alice"]);
  });
});
