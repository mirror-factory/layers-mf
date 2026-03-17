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

import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/settings/notifications", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockUser = { id: "u-1", email: "user@test.com" };

function mockMemberQuery(orgId: string | null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      orgId
        ? { data: { org_id: orgId }, error: null }
        : { data: null, error: { message: "Not found" } }
    ),
  };
  return chain;
}

function mockPrefsSelect(prefs: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: prefs,
            error: prefs ? null : { code: "PGRST116" },
          }),
        }),
      }),
    }),
  };
}

function mockPrefsInsert(success: boolean) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: success
            ? {
                digest_enabled: true,
                digest_time: "07:00",
                email_on_mention: true,
                email_on_action_item: true,
                email_on_new_context: false,
                weekly_summary: true,
              }
            : null,
          error: success ? null : { message: "Insert failed" },
        }),
      }),
    }),
  };
}

describe("GET /api/settings/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns defaults for new user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1");
    const prefsSelectChain = mockPrefsSelect(null);
    const prefsInsertChain = mockPrefsInsert(true);

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "notification_preferences") {
        fromCallCount++;
        // First call is select (returns null), second is insert
        if (fromCallCount === 1) return prefsSelectChain;
        return prefsInsertChain;
      }
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.digest_enabled).toBe(true);
    expect(body.digest_time).toBe("07:00");
    expect(body.email_on_mention).toBe(true);
    expect(body.email_on_action_item).toBe(true);
    expect(body.email_on_new_context).toBe(false);
    expect(body.weekly_summary).toBe(true);
  });

  it("returns saved preferences", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const savedPrefs = {
      digest_enabled: false,
      digest_time: "09:00",
      email_on_mention: false,
      email_on_action_item: true,
      email_on_new_context: true,
      weekly_summary: false,
    };

    const memberChain = mockMemberQuery("org-1");
    const prefsSelectChain = mockPrefsSelect(savedPrefs);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "notification_preferences") return prefsSelectChain;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.digest_enabled).toBe(false);
    expect(body.digest_time).toBe("09:00");
    expect(body.email_on_new_context).toBe(true);
    expect(body.weekly_summary).toBe(false);
  });
});

describe("PATCH /api/settings/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await PATCH(makePatchRequest({ digest_enabled: false }));
    expect(res.status).toBe(401);
  });

  it("updates specific fields", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1");
    const existingChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "pref-1" },
              error: null,
            }),
          }),
        }),
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    let prefsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "notification_preferences") {
        prefsCallCount++;
        if (prefsCallCount === 1) return existingChain;
        return updateChain;
      }
      return {};
    });

    const res = await PATCH(
      makePatchRequest({ digest_enabled: false, digest_time: "09:00" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("validates digest_time format", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await PATCH(makePatchRequest({ digest_time: "9am" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when no fields provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
  });
});
