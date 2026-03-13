import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockExchangeCode,
  mockGetUser,
  mockAdminFrom,
  mockRpc,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockExchangeCode: vi.fn(),
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockCookieStore: {
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    from: mockAdminFrom,
    rpc: mockRpc,
  }),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/auth/callback");
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when no code param", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("auth_callback_failed");
  });

  it("exchanges code for session on valid code", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "test@test.com" } } });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    await GET(makeRequest({ code: "valid-code" }));
    expect(mockExchangeCode).toHaveBeenCalledWith("valid-code");
  });

  it("redirects to / on successful exchange", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "test@test.com" } } });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("redirects to custom next path when provided", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "test@test.com" } } });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const res = await GET(makeRequest({ code: "valid-code", next: "/chat" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/chat");
  });

  it("auto-accepts pending invitations after code exchange", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "invited@test.com" } },
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "inv-1" }, { id: "inv-2" }],
          }),
        }),
      }),
    });
    mockRpc.mockResolvedValue({ error: null });

    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("accept_invitation", {
      invitation_id: "inv-1",
      accepting_user_id: "u-1",
    });
    expect(mockRpc).toHaveBeenCalledWith("accept_invitation", {
      invitation_id: "inv-2",
      accepting_user_id: "u-1",
    });
  });

  it("redirects to /login on exchange error", async () => {
    mockExchangeCode.mockResolvedValue({ error: { message: "Invalid code" } });

    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects with error when code is expired", async () => {
    mockExchangeCode.mockResolvedValue({
      error: { message: "Authorization code has expired" },
    });

    const res = await GET(makeRequest({ code: "expired-code" }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
  });

  it("redirects with error when code exchange returns server error", async () => {
    mockExchangeCode.mockResolvedValue({
      error: { message: "server_error", status: 500 },
    });

    const res = await GET(makeRequest({ code: "server-error-code" }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
  });

  it("handles user with no email gracefully (skips invitation check)", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: null } },
    });

    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    // Should NOT have called adminFrom since user has no email
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("handles getUser returning null user gracefully", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("handles invitation acceptance failure gracefully (still redirects)", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "test@test.com" } },
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "inv-1" }],
          }),
        }),
      }),
    });
    mockRpc.mockResolvedValue({ error: { message: "RPC failed" } });

    const res = await GET(makeRequest({ code: "valid-code" }));
    // Should still redirect successfully even if invitation acceptance fails
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("handles invitation query failure gracefully (still redirects)", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "test@test.com" } },
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "DB error" },
          }),
        }),
      }),
    });

    const res = await GET(makeRequest({ code: "valid-code" }));
    // Should still redirect even if invitation query fails
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
