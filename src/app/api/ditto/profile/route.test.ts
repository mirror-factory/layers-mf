import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ditto/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockOrgMember(orgId = "org-1") {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { org_id: orgId } }),
      }),
    }),
  };
}

describe("GET /api/ditto/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns profile for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    const profileData = {
      interests: ["pricing", "engineering"],
      preferred_sources: { linear: 0.8 },
      communication_style: "casual",
      detail_level: "moderate",
      priority_topics: ["billing"],
      working_hours: { start: 9, end: 17 },
      confidence: 0.65,
      interaction_count: 130,
      last_generated_at: "2026-03-19T07:00:00Z",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "ditto_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: profileData }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.interests).toEqual(["pricing", "engineering"]);
    expect(body.confidence).toBe(0.65);
    expect(body.interaction_count).toBe(130);
  });

  it("returns defaults for new user with no profile", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-new" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "ditto_profiles") {
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

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.confidence).toBe(0);
    expect(body.interaction_count).toBe(0);
    expect(body.communication_style).toBe("balanced");
    expect(body.detail_level).toBe("moderate");
    expect(body.interests).toEqual([]);
    expect(body.last_generated_at).toBeNull();
  });
});

describe("PATCH /api/ditto/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });

    const res = await PATCH(
      makePatchRequest({ communication_style: "formal" })
    );
    expect(res.status).toBe(401);
  });

  it("updates fields", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    const updatedProfile = {
      interests: [],
      preferred_sources: {},
      communication_style: "formal",
      detail_level: "brief",
      priority_topics: [],
      working_hours: { start: 9, end: 17 },
      confidence: 0.5,
      interaction_count: 100,
      last_generated_at: "2026-03-19T07:00:00Z",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return mockOrgMember();
      if (table === "ditto_profiles") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedProfile,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await PATCH(
      makePatchRequest({
        communication_style: "formal",
        detail_level: "brief",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.communication_style).toBe("formal");
    expect(body.detail_level).toBe("brief");
  });

  it("returns 400 with empty body", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1" } },
      error: null,
    });

    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
  });
});
