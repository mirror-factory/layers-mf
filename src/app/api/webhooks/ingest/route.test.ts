import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockInngestSend } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInngestSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(
  body: unknown,
  secret?: string
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) headers["x-webhook-secret"] = secret;

  return new NextRequest("http://localhost:3000/api/webhooks/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const VALID_SECRET = "test-webhook-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WEBHOOK_SECRET", VALID_SECRET);
});

describe("POST /api/webhooks/ingest", () => {
  it("returns 401 when x-webhook-secret header is missing", async () => {
    const res = await POST(makeRequest({ title: "t", content: "c", source_type: "s" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when x-webhook-secret header is wrong", async () => {
    const res = await POST(makeRequest({ title: "t", content: "c", source_type: "s" }, "wrong"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeRequest({ content: "c", source_type: "s" }, VALID_SECRET));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: title");
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(makeRequest({ title: "t", source_type: "s", org_id: "org-1" }, VALID_SECRET));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: content");
  });

  it("returns 400 when source_type is missing", async () => {
    const res = await POST(makeRequest({ title: "t", content: "c", org_id: "org-1" }, VALID_SECRET));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: source_type");
  });

  it("returns 400 when org_id is missing", async () => {
    const res = await POST(makeRequest({ title: "t", content: "c", source_type: "s" }, VALID_SECRET));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: org_id");
  });

  it("returns 200 with id and status accepted on valid payload", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "ci-99" }, error: null }),
        }),
      }),
    });

    const res = await POST(
      makeRequest(
        { title: "Test Doc", content: "Hello world", source_type: "webhook", org_id: "org-1" },
        VALID_SECRET
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "ci-99", status: "accepted" });
  });

  it("inserts context_item with correct fields including metadata", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-100" }, error: null }),
      }),
    });
    mockFrom.mockReturnValue({ insert: insertMock });

    const metadata = { origin: "zapier", ref: "abc-123" };
    await POST(
      makeRequest(
        { title: "Zap Doc", content: "body text", source_type: "zapier", org_id: "org-1", metadata },
        VALID_SECRET
      )
    );

    expect(mockFrom).toHaveBeenCalledWith("context_items");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        title: "Zap Doc",
        raw_content: "body text",
        source_type: "zapier",
        content_type: "document",
        status: "pending",
        source_metadata: metadata,
      })
    );
  });

  it("returns 500 when database insert fails", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      }),
    });

    const res = await POST(
      makeRequest(
        { title: "t", content: "c", source_type: "s", org_id: "org-1" },
        VALID_SECRET
      )
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB error");
  });
});
