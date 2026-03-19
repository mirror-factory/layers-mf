import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/ditto/profile", () => ({
  DEFAULT_PROFILE: {
    interests: [],
    preferred_sources: {},
    communication_style: "balanced",
    detail_level: "moderate",
    priority_topics: [],
    working_hours: { start: 9, end: 17 },
  },
}));

import { GET } from "./route";

// --- Helpers ---

function chainedQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue({ data, error });
  // For non-single queries, make the chain itself resolve
  chain.data = data;
  chain.error = error;
  return chain;
}

function setupMocks({
  user = { id: "user-1" },
  member = { org_id: "org-1" },
  profile = null as Record<string, unknown> | null,
  interactions = [] as { resource_id: string }[],
  contextItems = [] as Record<string, unknown>[],
}: {
  user?: { id: string } | null;
  member?: { org_id: string } | null;
  profile?: Record<string, unknown> | null;
  interactions?: { resource_id: string }[];
  contextItems?: Record<string, unknown>[];
} = {}) {
  mockGetUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: "No user" },
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") return chainedQuery(member);
    if (table === "ditto_profiles") return chainedQuery(profile);
    if (table === "user_interactions") {
      const chain = chainedQuery(interactions);
      // Override: interactions returns array, not single
      return chain;
    }
    if (table === "context_items") {
      const chain = chainedQuery(contextItems);
      return chain;
    }
    return chainedQuery(null);
  });
}

describe("GET /api/ditto/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    setupMocks({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns suggestions for authenticated user", async () => {
    const items = [
      {
        id: "item-1",
        title: "Q2 Pricing Strategy",
        source_type: "google-drive",
        content_type: "document",
        ingested_at: new Date().toISOString(),
        description_short: "Pricing analysis",
      },
      {
        id: "item-2",
        title: "Sprint Retro Notes",
        source_type: "linear",
        content_type: "issue",
        ingested_at: new Date().toISOString(),
        description_short: "Retro notes",
      },
    ];

    setupMocks({ contextItems: items });
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestions).toBeDefined();
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions[0]).toHaveProperty("id");
    expect(body.suggestions[0]).toHaveProperty("title");
    expect(body.suggestions[0]).toHaveProperty("reason");
    expect(body.suggestions[0]).toHaveProperty("score");
  });

  it("returns empty suggestions when no profile and no items", async () => {
    setupMocks({ contextItems: [] });
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });

  it("excludes already-clicked items", async () => {
    const items = [
      {
        id: "item-clicked",
        title: "Already Read",
        source_type: "slack",
        content_type: "message",
        ingested_at: new Date().toISOString(),
        description_short: null,
      },
      {
        id: "item-new",
        title: "New Item",
        source_type: "github",
        content_type: "issue",
        ingested_at: new Date().toISOString(),
        description_short: null,
      },
    ];

    setupMocks({
      contextItems: items,
      interactions: [{ resource_id: "item-clicked" }],
    });

    const res = await GET();
    const body = await res.json();

    const ids = body.suggestions.map((s: { id: string }) => s.id);
    expect(ids).not.toContain("item-clicked");
    expect(ids).toContain("item-new");
  });

  it("returns 400 when no organization found", async () => {
    setupMocks({ member: null });
    const res = await GET();
    expect(res.status).toBe(400);
  });
});
