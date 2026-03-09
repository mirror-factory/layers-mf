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

function makeRequest(format?: string): NextRequest {
  const url = format
    ? `http://localhost:3000/api/context/export?format=${format}`
    : "http://localhost:3000/api/context/export";
  return new NextRequest(url, { method: "GET" });
}

const mockItems = [
  {
    title: "Q3 Report",
    source_type: "upload",
    content_type: "document",
    description_short: "Quarterly summary",
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    title: 'Doc with "quotes"',
    source_type: "google-drive",
    content_type: "spreadsheet",
    description_short: null,
    created_at: "2026-02-15T00:00:00Z",
  },
];

function mockAuthenticatedWithItems() {
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
            order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

describe("GET /api/context/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not auth" } });

    const res = await GET(makeRequest());
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

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No organization found");
  });

  it("returns JSON array by default", async () => {
    mockAuthenticatedWithItems();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].title).toBe("Q3 Report");
  });

  it("returns JSON array with explicit format=json", async () => {
    mockAuthenticatedWithItems();

    const res = await GET(makeRequest("json"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it("returns CSV with correct headers and content-type", async () => {
    mockAuthenticatedWithItems();

    const res = await GET(makeRequest("csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename=context-export.csv");

    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines[0]).toBe("title,source_type,content_type,description_short,created_at");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("escapes double quotes in CSV values", async () => {
    mockAuthenticatedWithItems();

    const res = await GET(makeRequest("csv"));
    const csv = await res.text();
    const lines = csv.split("\n");
    // Second data row has title with quotes
    expect(lines[2]).toContain('""quotes""');
  });
});
