import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockGetActionItems, mockUpdateActionItemStatus } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockGetActionItems: vi.fn(),
    mockUpdateActionItemStatus: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("@/lib/db/action-items", () => ({
  getActionItems: mockGetActionItems,
  updateActionItemStatus: mockUpdateActionItemStatus,
}));

import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(params = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/actions${params}`, {
    method: "GET",
  });
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/actions", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u-1" } },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { org_id: "org-1" } }),
      }),
    }),
  });
}

describe("GET /api/actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it("returns 200 with action items list", async () => {
    mockAuthenticatedUser();
    const items = [
      {
        context_item_id: "ci-1",
        action_index: 0,
        task: "Do something",
        status: "pending",
        source_type: "google-drive",
        content_type: "meeting_notes",
        source_title: "Meeting",
        source_created_at: "2026-03-13",
        completed_at: null,
      },
    ];
    mockGetActionItems.mockResolvedValue(items);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].task).toBe("Do something");
  });

  it("returns 200 with empty array when no items", async () => {
    mockAuthenticatedUser();
    mockGetActionItems.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("passes filter params to getActionItems", async () => {
    mockAuthenticatedUser();
    mockGetActionItems.mockResolvedValue([]);

    await GET(makeGetRequest("?status=done&sourceType=slack&limit=50&offset=10"));

    expect(mockGetActionItems).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      { status: "done", sourceType: "slack" },
      50,
      10
    );
  });

  it("caps limit at 200", async () => {
    mockAuthenticatedUser();
    mockGetActionItems.mockResolvedValue([]);

    await GET(makeGetRequest("?limit=500"));

    expect(mockGetActionItems).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      { status: undefined, sourceType: undefined },
      200,
      0
    );
  });
});

describe("PATCH /api/actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0, status: "done" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no org", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0, status: "done" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when contextItemId is missing", async () => {
    mockAuthenticatedUser();
    const res = await PATCH(makePatchRequest({ actionIndex: 0, status: "done" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("returns 400 when actionIndex is missing", async () => {
    mockAuthenticatedUser();
    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", status: "done" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is missing", async () => {
    mockAuthenticatedUser();
    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0 })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    mockAuthenticatedUser();
    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0, status: "invalid" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid status");
  });

  it("returns 200 when updating status to done", async () => {
    mockAuthenticatedUser();
    mockUpdateActionItemStatus.mockResolvedValue(undefined);

    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0, status: "done" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockUpdateActionItemStatus).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "u-1",
      "ci-1",
      0,
      "done"
    );
  });

  it("returns 200 when updating status to cancelled", async () => {
    mockAuthenticatedUser();
    mockUpdateActionItemStatus.mockResolvedValue(undefined);

    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 1, status: "cancelled" })
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when updating status to pending", async () => {
    mockAuthenticatedUser();
    mockUpdateActionItemStatus.mockResolvedValue(undefined);

    const res = await PATCH(
      makePatchRequest({ contextItemId: "ci-1", actionIndex: 0, status: "pending" })
    );
    expect(res.status).toBe(200);
  });
});
