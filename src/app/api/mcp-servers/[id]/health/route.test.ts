import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserAndOrg: vi.fn(),
  testMCPConnection: vi.fn(),
  ensureAuth: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireUserAndOrg: mocks.requireUserAndOrg,
  isAuthFailure: (value: unknown) => Boolean(value && typeof value === "object" && "response" in value),
}));

vi.mock("@/lib/mcp/connect", () => ({
  testMCPConnection: mocks.testMCPConnection,
}));

vi.mock("@/lib/mcp/connection-manager", () => ({
  ensureAuth: mocks.ensureAuth,
}));

import { POST } from "./route";

const baseServer = {
  id: "mcp-1",
  org_id: "org-1",
  name: "Linear",
  url: "https://mcp.example.test",
  api_key_encrypted: "token",
  transport_type: "http",
  auth_type: "bearer",
  oauth_refresh_token: null,
  oauth_expires_at: null,
  oauth_token_url: null,
  oauth_client_id: null,
  oauth_client_secret: null,
  failure_count: 2,
};

function createSupabase(server = baseServer) {
  const updateEqOrg = vi.fn().mockResolvedValue({ error: null });
  const updateEqId = vi.fn(() => ({ eq: updateEqOrg }));
  const update = vi.fn(() => ({ eq: updateEqId }));

  const selectEqOrg = {
    single: vi.fn().mockResolvedValue({ data: server, error: null }),
  };
  const selectEqId = { eq: vi.fn(() => selectEqOrg) };
  const select = vi.fn(() => ({ eq: vi.fn(() => selectEqId) }));

  return {
    from: vi.fn(() => ({ select, update })),
    update,
  };
}

function context(id = "mcp-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/mcp-servers/[id]/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureAuth.mockResolvedValue({ apiKey: "token", refreshed: false });
  });

  it("updates healthy server state and snapshots tools", async () => {
    const supabase = createSupabase();
    mocks.requireUserAndOrg.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      orgId: "org-1",
    });
    mocks.testMCPConnection.mockResolvedValue({
      success: true,
      toolCount: 2,
      toolNames: ["search", "issue"],
    });

    const response = await POST(new Request("http://localhost/api/mcp-servers/mcp-1/health"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthStatus).toBe("healthy");
    expect(body.failureCount).toBe(0);
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
      health_status: "healthy",
      failure_count: 0,
      reconnect_after: null,
      is_active: true,
      error_message: null,
      tool_snapshot: expect.arrayContaining([
        expect.objectContaining({ name: "issue" }),
        expect.objectContaining({ name: "search" }),
      ]),
    }));
  });

  it("records failed checks with reconnect backoff", async () => {
    const supabase = createSupabase();
    mocks.requireUserAndOrg.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      orgId: "org-1",
    });
    mocks.testMCPConnection.mockResolvedValue({
      success: false,
      toolCount: 0,
      toolNames: [],
      error: "socket closed",
    });

    const response = await POST(new Request("http://localhost/api/mcp-servers/mcp-1/health"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthStatus).toBe("down");
    expect(body.failureCount).toBe(3);
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
      health_status: "down",
      failure_count: 3,
      is_active: false,
      error_message: "socket closed",
      reconnect_after: expect.any(String),
    }));
  });
});
