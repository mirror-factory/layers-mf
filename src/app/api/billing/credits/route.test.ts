import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const { GET } = await import("./route");

function makeReq() {
  return new Request("http://localhost/api/billing/credits");
}

describe("GET /api/billing/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no org", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => ({ data: null }) }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns credit balance for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { org_id: "org1" } }),
            }),
          }),
        };
      }
      // organizations table
      return {
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { credit_balance: 250, stripe_customer_id: "cus_123" },
            }),
          }),
        }),
      };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credits).toBe(250);
    expect(body.hasStripeCustomer).toBe(true);
    expect(body.orgId).toBe("org1");
  });
});
