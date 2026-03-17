import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session_123" }),
      },
    },
  },
  CREDIT_PACKAGES: [
    { id: "credits_100", credits: 100, priceInCents: 999, label: "100 credits" },
  ],
}));

const { POST } = await import("./route");

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq({ packageId: "credits_100" }));
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
    const res = await POST(makeReq({ packageId: "credits_100" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid package", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { org_id: "org1", role: "owner" } }),
        }),
      }),
    });
    const res = await POST(makeReq({ packageId: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns checkout URL for valid request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { org_id: "org1", role: "owner" } }),
        }),
      }),
    });
    const res = await POST(makeReq({ packageId: "credits_100" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("stripe.com");
  });
});
