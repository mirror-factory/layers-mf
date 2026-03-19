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

import { GET, POST, DELETE } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/settings/api-keys", {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

const mockUser = { id: "u-1", email: "admin@test.com" };

function mockMemberQuery(orgId: string | null, role = "owner") {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      orgId
        ? { data: { org_id: orgId, role }, error: null }
        : { data: null, error: { message: "Not found" } }
    ),
  };
}

function mockSelectKeysQuery(keys: Record<string, unknown>[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: keys, error: null }),
      }),
    }),
  };
}

function mockInsertQuery(inserted: Record<string, unknown>) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
      }),
    }),
  };
}

function mockDeleteQuery(success: boolean) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: success ? null : { message: "Delete failed" },
        }),
      }),
    }),
  };
}

describe("GET /api/settings/api-keys", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin/owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "member");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns keys for owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const keysChain = mockSelectKeysQuery([
      {
        id: "key-1",
        name: "Production",
        key_prefix: "sk_live_...abc123",
        created_at: "2026-03-19T00:00:00Z",
        last_used_at: null,
      },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return keysChain;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].id).toBe("key-1");
    expect(body.keys[0].masked_key).toBe("sk_live_...abc123");
  });

  it("returns keys for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "admin");
    const keysChain = mockSelectKeysQuery([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return keysChain;
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keys).toHaveLength(0);
  });
});

describe("POST /api/settings/api-keys", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await POST(makeRequest("POST", { name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin/owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "member");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await POST(makeRequest("POST", { name: "Test" }));
    expect(res.status).toBe(403);
  });

  it("creates a key and returns it with the full key", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const insertChain = mockInsertQuery({
      id: "key-new",
      name: "Production API",
      created_at: "2026-03-19T00:00:00Z",
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return insertChain;
      return {};
    });

    const res = await POST(makeRequest("POST", { name: "Production API" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("key-new");
    expect(body.key).toMatch(/^sk_live_/);
    expect(body.key.length).toBeGreaterThan(20);
    expect(body.name).toBe("Production API");
  });

  it("hashes the key before storage (key_hash is sha256)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    let capturedInsert: Record<string, unknown> | null = null;

    const insertChain = {
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        capturedInsert = data;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "key-new", name: "Test", created_at: "2026-03-19T00:00:00Z" },
              error: null,
            }),
          }),
        };
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return insertChain;
      return {};
    });

    await POST(makeRequest("POST", { name: "Test" }));
    expect(capturedInsert).not.toBeNull();
    // key_hash should be a 64-char hex string (SHA-256)
    expect(capturedInsert!.key_hash).toMatch(/^[a-f0-9]{64}$/);
    // key_prefix should be masked
    expect(capturedInsert!.key_prefix).toContain("...");
  });
});

describe("DELETE /api/settings/api-keys", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not auth" },
    });
    const res = await DELETE(makeRequest("DELETE", { id: "key-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin/owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "member");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { id: "key-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 with missing key id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      return {};
    });

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/settings/api-keys", {
        method: "DELETE",
      })
    );
    expect(res.status).toBe(400);
  });

  it("deletes a key for owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const deleteChain = mockDeleteQuery(true);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return deleteChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { id: "key-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when delete fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const memberChain = mockMemberQuery("org-1", "owner");
    const deleteChain = mockDeleteQuery(false);

    mockFrom.mockImplementation((table: string) => {
      if (table === "org_members") return memberChain;
      if (table === "api_keys") return deleteChain;
      return {};
    });

    const res = await DELETE(makeRequest("DELETE", { id: "key-1" }));
    expect(res.status).toBe(500);
  });
});
