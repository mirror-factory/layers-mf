import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateInboxForUser } = vi.hoisted(() => ({
  mockGenerateInboxForUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        data: [
          { org_id: "org-1", user_id: "user-1" },
          { org_id: "org-1", user_id: "user-2" },
        ],
        error: null,
      }),
    }),
  }),
}));

vi.mock("@/lib/inbox/generate", () => ({
  generateInboxForUser: mockGenerateInboxForUser,
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/inbox/generate", {
    method: "POST",
    headers,
  });
}

describe("POST /api/inbox/generate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-secret" };
  });

  it("returns 401 without valid CRON_SECRET", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const res = await POST(makeRequest({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("processes all org members with valid auth", async () => {
    mockGenerateInboxForUser.mockResolvedValue(3);

    const res = await POST(
      makeRequest({ authorization: "Bearer test-secret" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(6); // 3 per user x 2 users
    expect(body.users).toBe(2);
    expect(body.errors).toBeUndefined();
  });

  it("reports errors per user without failing the entire request", async () => {
    mockGenerateInboxForUser
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error("AI quota exceeded"));

    const res = await POST(
      makeRequest({ authorization: "Bearer test-secret" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(2);
    expect(body.users).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("AI quota exceeded");
  });

  it("returns generated=0 users=0 when no org members exist", async () => {
    // Override the mock to return empty members
    const { createAdminClient } = await import("@/lib/supabase/server");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [],
          error: null,
        }),
      }),
    });

    const res = await POST(
      makeRequest({ authorization: "Bearer test-secret" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(0);
    expect(body.users).toBe(0);
  });

  it("returns 500 when members query fails", async () => {
    const { createAdminClient } = await import("@/lib/supabase/server");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: null,
          error: { message: "DB connection lost" },
        }),
      }),
    });

    const res = await POST(
      makeRequest({ authorization: "Bearer test-secret" })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("DB connection lost");
  });
});
