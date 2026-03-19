import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockCheckoutCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
      update: (...args: unknown[]) => mockSubscriptionsUpdate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutCreate(...args),
      },
    },
  },
  PLAN_TIERS: {
    free: { name: "Free", credits_per_month: 50, price_id: null },
    starter: {
      name: "Starter",
      credits_per_month: 500,
      price_id: "price_starter_123",
    },
    pro: {
      name: "Pro",
      credits_per_month: 5000,
      price_id: "price_pro_123",
    },
  },
  getPlanFromPriceId: (priceId: string | null) => {
    if (priceId === "price_starter_123") return "starter";
    if (priceId === "price_pro_123") return "pro";
    return "free";
  },
}));

const { GET, POST, DELETE } = await import("./route");

function makeReq(
  method: string,
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest("http://localhost/api/billing/subscription", {
    method,
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// Helper to set up authenticated owner
function mockAuthenticatedOwner(orgOverrides?: Record<string, unknown>) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "u@test.com" } } });

  let callCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "org_members") {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({ data: { org_id: "org1", role: "owner" } }),
          }),
        }),
      };
    }
    if (table === "organizations") {
      callCount++;
      return {
        select: () => ({
          eq: () => ({
            single: () => ({
              data: {
                stripe_customer_id: "cus_123",
                credit_balance: 100,
                ...orgOverrides,
              },
            }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }) };
  });
}

describe("GET /api/billing/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no org", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns free plan when no stripe customer", async () => {
    mockAuthenticatedOwner({ stripe_customer_id: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("free");
    expect(body.credits_per_month).toBe(50);
    expect(body.current_period_end).toBeNull();
  });

  it("returns current subscription for paid plan", async () => {
    mockAuthenticatedOwner();
    mockSubscriptionsList.mockResolvedValue({
      data: [
        {
          items: { data: [{ price: { id: "price_starter_123" } }] },
          status: "active",
          current_period_end: 1735689600,
          cancel_at_period_end: false,
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("starter");
    expect(body.credits_per_month).toBe(500);
    expect(body.status).toBe("active");
    expect(body.cancel_at_period_end).toBe(false);
    expect(body.current_period_end).toBeTruthy();
  });
});

describe("POST /api/billing/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq("POST", { plan: "starter" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin members", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { org_id: "org1", role: "member" } }),
        }),
      }),
    });
    const res = await POST(makeReq("POST", { plan: "starter" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to subscribe to free plan", async () => {
    mockAuthenticatedOwner();
    const res = await POST(makeReq("POST", { plan: "free" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("free");
  });

  it("creates checkout session for starter plan", async () => {
    mockAuthenticatedOwner();
    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_sub_123",
    });

    const res = await POST(makeReq("POST", { plan: "starter" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("stripe.com");
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_starter_123", quantity: 1 }],
      })
    );
  });

  it("creates checkout session for pro plan", async () => {
    mockAuthenticatedOwner();
    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_pro_123",
    });

    const res = await POST(makeReq("POST", { plan: "pro" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("stripe.com");
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro_123", quantity: 1 }],
      })
    );
  });

  it("returns 400 for invalid plan", async () => {
    mockAuthenticatedOwner();
    const res = await POST(makeReq("POST", { plan: "enterprise" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/billing/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin members", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { org_id: "org1", role: "member" } }),
        }),
      }),
    });
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("returns 400 when no stripe customer", async () => {
    mockAuthenticatedOwner({ stripe_customer_id: null });
    const res = await DELETE();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No active subscription");
  });

  it("cancels subscription at period end", async () => {
    mockAuthenticatedOwner();
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: "sub_123" }],
    });
    mockSubscriptionsUpdate.mockResolvedValue({});

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("canceled");
    expect(body.cancel_at_period_end).toBe(true);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });
  });

  it("returns 400 when no active subscription found", async () => {
    mockAuthenticatedOwner();
    mockSubscriptionsList.mockResolvedValue({ data: [] });

    const res = await DELETE();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No active subscription");
  });
});
