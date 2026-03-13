import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdminFrom, mockRpc } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/kpi/compute", () => ({
  computeHealthSummary: vi.fn().mockReturnValue({
    status: "pass",
    context: [{ name: "Pipeline Success Rate", value: 0.98, target: 0.95, unit: "%", status: "pass" }],
    sources: [],
    agent: [],
  }),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL("http://localhost:3000/api/health");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, { headers });
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HEALTH_CHECK_SECRET;
  });

  it("returns 400 when org_id is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("org_id query parameter required");
  });

  it("returns 200 with health data when org_id is provided", async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });
    const res = await GET(makeRequest({ org_id: "org-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pass");
    expect(body.timestamp).toBeDefined();
    expect(body.context_health).toBeDefined();
    expect(body.agent).toBeDefined();
  });

  it("returns 401 when secret is set but not provided", async () => {
    process.env.HEALTH_CHECK_SECRET = "my-secret";
    const res = await GET(makeRequest({ org_id: "org-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is set but wrong value provided", async () => {
    process.env.HEALTH_CHECK_SECRET = "my-secret";
    const res = await GET(
      makeRequest({ org_id: "org-1" }, { "x-health-secret": "wrong" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 when correct secret is provided", async () => {
    process.env.HEALTH_CHECK_SECRET = "my-secret";
    mockRpc.mockResolvedValue({ data: {}, error: null });
    const res = await GET(
      makeRequest({ org_id: "org-1" }, { "x-health-secret": "my-secret" })
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 when RPC calls fail", async () => {
    mockRpc.mockImplementation((_name: string) => {
      return Promise.resolve({
        data: null,
        error: { message: "RPC failed" },
      });
    });
    const res = await GET(makeRequest({ org_id: "org-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("RPC error");
    expect(body.details).toBeDefined();
  });

  it("includes integrations data in response", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_integration_health") {
        return Promise.resolve({
          data: [{ provider: "slack", status: "active" }],
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });
    const res = await GET(makeRequest({ org_id: "org-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.integrations).toEqual([{ provider: "slack", status: "active" }]);
  });
});
