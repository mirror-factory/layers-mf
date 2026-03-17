import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const { mockAdminFrom, mockNangoListRecords, mockInngestSend } = vi.hoisted(
  () => ({
    mockAdminFrom: vi.fn(),
    mockNangoListRecords: vi.fn(),
    mockInngestSend: vi.fn(),
  })
);

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { listRecords: mockNangoListRecords },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock("@/lib/integrations/nango-mappers", () => ({
  mapNangoRecord: vi.fn(),
}));

vi.mock("@/lib/webhook-dedup", () => ({
  claimWebhookEvent: vi.fn().mockResolvedValue(true),
  completeWebhookEvent: vi.fn().mockResolvedValue(undefined),
  hashPayload: vi.fn().mockReturnValue("mock-hash"),
}));

vi.mock("@/lib/versioning", () => ({
  computeContentHash: vi.fn(() => "hash-abc"),
  detectChanges: vi.fn(() => ({ changed: false })),
  createVersion: vi.fn(),
}));

import { POST, verifyNangoSignature } from "./route";
import { NextRequest } from "next/server";

const WEBHOOK_SECRET = "test-nango-webhook-secret";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(
  body: unknown,
  options?: { secret?: string; omitSignature?: boolean }
): NextRequest {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (!options?.omitSignature && options?.secret) {
    headers["x-nango-signature"] = sign(rawBody, options.secret);
  }

  return new NextRequest("http://localhost:3000/api/webhooks/nango", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NANGO_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

// ── verifyNangoSignature ────────────────────────────────────────────────────

describe("verifyNangoSignature", () => {
  const secret = "test-secret";

  it("returns true for a valid HMAC-SHA256 signature", () => {
    const body = '{"type":"auth"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyNangoSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = '{"type":"auth"}';
    const sig = "0".repeat(64);
    expect(verifyNangoSignature(body, sig, secret)).toBe(false);
  });

  it("returns false when body is empty", () => {
    expect(verifyNangoSignature("", "abc", secret)).toBe(false);
  });

  it("returns false when signature is empty", () => {
    expect(verifyNangoSignature("body", "", secret)).toBe(false);
  });

  it("returns false when secret is empty", () => {
    expect(verifyNangoSignature("body", "abc", "")).toBe(false);
  });

  it("returns false for non-hex signature", () => {
    expect(verifyNangoSignature("body", "not-hex!", secret)).toBe(false);
  });
});

// ── POST /api/webhooks/nango — signature verification ───────────────────────

describe("POST /api/webhooks/nango — signature verification", () => {
  it("returns 401 when signature is missing and secret is configured", async () => {
    const payload = { type: "auth", success: true, operation: "creation" };
    const req = makeRequest(payload, { omitSignature: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns 401 when signature is invalid", async () => {
    const payload = { type: "auth", success: true, operation: "creation" };
    const rawBody = JSON.stringify(payload);
    const req = new NextRequest("http://localhost:3000/api/webhooks/nango", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nango-signature": "0".repeat(64),
      },
      body: rawBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid signature and processes the request", async () => {
    const payload = { type: "auth", success: true, operation: "creation",
      connectionId: "conn-1", providerConfigKey: "google-drive",
      tags: { organization_id: "org-1", end_user_id: "user-1" } };

    mockAdminFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeRequest(payload, { secret: WEBHOOK_SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("proceeds without verification when NANGO_WEBHOOK_SECRET is not set", async () => {
    vi.stubEnv("NANGO_WEBHOOK_SECRET", "");
    const payload = { type: "auth", success: true, operation: "creation",
      connectionId: "conn-1", providerConfigKey: "google-drive",
      tags: { organization_id: "org-1", end_user_id: "user-1" } };

    mockAdminFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    // No signature provided, but should still work
    const req = makeRequest(payload, { omitSignature: true });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns 400 for invalid JSON body with valid signature", async () => {
    const invalidBody = "not-json{{{";
    const signature = sign(invalidBody, WEBHOOK_SECRET);
    const req = new NextRequest("http://localhost:3000/api/webhooks/nango", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nango-signature": signature,
      },
      body: invalidBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });
});
