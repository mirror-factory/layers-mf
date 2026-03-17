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
  return new NextRequest("http://localhost:3000/api/context/ci-1/versions", {
    method: "GET",
  });
}

const mockParams = Promise.resolve({ id: "ci-1" });

// Helper to build chained Supabase mock for context_item_versions
function buildVersionsChain(versions: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: versions, error: null }),
          }),
        }),
      }),
    }),
  };
}

function buildItemCheck(found: boolean) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: found ? { id: "ci-1" } : null,
            error: found ? null : { message: "Not found" },
          }),
        }),
      }),
    }),
  };
}

function buildOrgMember(orgId: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: orgId ? { org_id: orgId } : null,
        }),
      }),
    }),
  };
}

describe("GET /api/context/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns versions for a valid item", async () => {
    const mockVersions = [
      {
        version_number: 2,
        title: "Updated Title",
        change_type: "content_updated",
        changed_fields: ["title", "raw_content"],
        changed_by: "sync:linear",
        created_at: "2026-03-15T10:00:00Z",
        raw_content: "Some updated content that is short",
      },
      {
        version_number: 1,
        title: "Initial Title",
        change_type: "created",
        changed_fields: [],
        changed_by: "sync:linear",
        created_at: "2026-03-14T08:00:00Z",
        raw_content: "Initial content",
      },
    ];

    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return buildOrgMember("org-1");
      if (table === "context_items") return buildItemCheck(true);
      if (table === "context_item_versions") return buildVersionsChain(mockVersions);
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.versions[0].version_number).toBe(2);
    expect(body.versions[0].content_preview).toBe("Some updated content that is short");
    // raw_content should NOT be in the response (only content_preview)
    expect(body.versions[0]).not.toHaveProperty("raw_content");
  });

  it("returns empty array for item with no versions", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return buildOrgMember("org-1");
      if (table === "context_items") return buildItemCheck(true);
      if (table === "context_item_versions") return buildVersionsChain([]);
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("respects org isolation — returns 404 for other org's item", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return buildOrgMember("org-1");
      // context_items check returns null (item belongs to different org)
      if (table === "context_items") return buildItemCheck(false);
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("truncates content_preview to 200 characters", async () => {
    const longContent = "A".repeat(300);
    const mockVersions = [
      {
        version_number: 1,
        title: "Long Content",
        change_type: "created",
        changed_fields: [],
        changed_by: "sync:linear",
        created_at: "2026-03-14T08:00:00Z",
        raw_content: longContent,
      },
    ];

    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return buildOrgMember("org-1");
      if (table === "context_items") return buildItemCheck(true);
      if (table === "context_item_versions") return buildVersionsChain(mockVersions);
      return {};
    });

    const res = await GET(makeRequest(), { params: mockParams });
    const body = await res.json();
    expect(body.versions[0].content_preview).toHaveLength(200);
  });
});
