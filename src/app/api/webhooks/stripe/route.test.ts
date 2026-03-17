import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  },
}));

const { POST } = await import("./route");

function makeReq(body: string, sig?: string) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sig ? { "stripe-signature": sig } : {}),
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 400 without signature", async () => {
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeReq("{}", "sig_invalid"));
    expect(res.status).toBe(400);
  });

  it("handles checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          metadata: { org_id: "org1", user_id: "u1", credits: "100" },
        },
      },
    });
    mockRpc.mockResolvedValue({ data: 100 });

    const res = await POST(makeReq("{}", "sig_valid"));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("add_credits", {
      p_user_id: "org1",
      p_amount: 100,
    });
  });

  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });
    const res = await POST(makeReq("{}", "sig_valid"));
    expect(res.status).toBe(200);
  });
});
