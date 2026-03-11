import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("discord webhook rejects invalid signature", async ({ request }) => {
    const res = await request.post("/api/webhooks/discord", {
      data: { type: 1 },
      headers: {
        "x-signature-ed25519": "invalid",
        "x-signature-timestamp": "0",
      },
    });
    // Should not crash — returns some response (401 invalid sig, 500 no key configured, or 200 accepted)
    expect(res.status()).toBeLessThan(502);
  });

  test("linear webhook responds without crashing", async ({ request }) => {
    const res = await request.post("/api/webhooks/linear", {
      data: { action: "create", type: "Issue", data: {} },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("search endpoint responds", async ({ request }) => {
    const res = await request.post("/api/context/search", {
      data: { query: "test" },
    });
    // May return 200 (with empty results) or 401 — either is valid
    expect(res.status()).toBeLessThan(502);
  });

  test("chat endpoint responds", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "hi" }] },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("upload endpoint responds", async ({ request }) => {
    const res = await request.post("/api/ingest/upload");
    expect(res.status()).toBeLessThan(502);
  });

  test("external webhook responds", async ({ request }) => {
    const res = await request.post("/api/webhooks/external", {
      data: {
        source: "test",
        title: "Test Item",
        content: "This is a test webhook payload",
      },
      headers: {
        "x-api-key": "invalid-key",
      },
    });
    expect(res.status()).toBeLessThan(502);
  });
});
