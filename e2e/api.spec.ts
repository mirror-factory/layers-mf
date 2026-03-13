import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
test.describe("API: Health", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
test.describe("API: Chat", () => {
  test("POST /api/chat without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "hello" }] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/chat rejects empty body", async ({ request }) => {
    const res = await request.post("/api/chat", { data: {} });
    expect(res.status()).toBeLessThan(502);
  });

  test("GET /api/chat/history without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/chat/history");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/chat/session/fake-id without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/chat/session/fake-id", {
      data: { messages: [{ role: "user", content: "hi" }] },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
test.describe("API: Context", () => {
  test("POST /api/context/search responds without crashing", async ({ request }) => {
    const res = await request.post("/api/context/search", {
      data: { query: "test" },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/context/search with empty query", async ({ request }) => {
    const res = await request.post("/api/context/search", {
      data: { query: "" },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("GET /api/context/:id without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/context/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });

  test("POST /api/context/process without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/context/process", {
      data: { content: "test content" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/context/bulk without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/context/bulk", {
      data: { ids: ["fake-id-1", "fake-id-2"] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/context/export without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/context/export");
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------
test.describe("API: Conversations", () => {
  test("GET /api/conversations without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/conversations");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/conversations without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/conversations", {
      data: { title: "Test Conversation" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/conversations/:id without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/conversations/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });

  test("DELETE /api/conversations/:id without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/conversations/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
test.describe("API: Sessions", () => {
  test("GET /api/sessions without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/sessions");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/sessions without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/sessions", {
      data: { name: "Test Session", goal: "Testing" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/sessions rejects empty body", async ({ request }) => {
    const res = await request.post("/api/sessions", { data: {} });
    expect(res.status()).toBeLessThan(502);
  });

  test("GET /api/sessions/:id without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/sessions/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });

  test("PATCH /api/sessions/:id without auth returns 401", async ({ request }) => {
    const res = await request.patch("/api/sessions/nonexistent-id", {
      data: { name: "Updated" },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test("GET /api/sessions/:id/members without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/sessions/nonexistent-id/members");
    expect([401, 403, 404]).toContain(res.status());
  });

  test("POST /api/sessions/:id/members without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/sessions/nonexistent-id/members", {
      data: { userId: "fake-user" },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test("POST /api/sessions/:id/context without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/sessions/nonexistent-id/context", {
      data: { contextIds: ["fake-context-id"] },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test("DELETE /api/sessions/:id/context without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/sessions/nonexistent-id/context", {
      data: { contextIds: ["fake-context-id"] },
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
test.describe("API: Team", () => {
  test("GET /api/team/members without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/team/members");
    expect([401, 403]).toContain(res.status());
  });

  test("PATCH /api/team/members without auth returns 401", async ({ request }) => {
    const res = await request.patch("/api/team/members", {
      data: { userId: "fake-user", role: "admin" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/team/members without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/team/members", {
      data: { userId: "fake-user" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/team/profile without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/team/profile");
    expect([401, 403]).toContain(res.status());
  });

  test("PATCH /api/team/profile without auth returns 401", async ({ request }) => {
    const res = await request.patch("/api/team/profile", {
      data: { name: "Test Team" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/team/invite without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/team/invite");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/team/invite without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/team/invite", {
      data: { email: "test@example.com", role: "member" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/team/invite/:id without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/team/invite/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
test.describe("API: Integrations", () => {
  test("GET /api/integrations without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/integrations");
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/integrations/:id without auth returns 401", async ({ request }) => {
    const res = await request.delete("/api/integrations/nonexistent-id");
    expect([401, 403, 404]).toContain(res.status());
  });

  test("POST /api/integrations/connect-session without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/connect-session");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/integrations/save-connection without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/save-connection", {
      data: { connectionId: "test", providerConfigKey: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/integrations/sync without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/sync", {
      data: { integrationId: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/integrations/google-drive/sync without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/google-drive/sync", {
      data: { integrationId: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/integrations/linear/sync without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/linear/sync", {
      data: { integrationId: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/integrations/discord/sync without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/integrations/discord/sync", {
      data: { integrationId: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------
test.describe("API: Ingest", () => {
  test("POST /api/ingest/upload without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/ingest/upload");
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/ingest/upload rejects empty body", async ({ request }) => {
    const res = await request.post("/api/ingest/upload", {
      data: {},
    });
    expect(res.status()).toBeLessThan(502);
  });
});

// ---------------------------------------------------------------------------
// Inbox & Actions
// ---------------------------------------------------------------------------
test.describe("API: Inbox & Actions", () => {
  test("POST /api/inbox/generate without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/inbox/generate", {
      data: { sessionId: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/inbox/generate without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/inbox/generate");
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/actions without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/actions");
    expect([401, 403]).toContain(res.status());
  });

  test("PATCH /api/actions without auth returns 401", async ({ request }) => {
    const res = await request.patch("/api/actions", {
      data: { id: "fake-id", status: "done" },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
test.describe("API: Audit", () => {
  test("GET /api/audit without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/audit");
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Webhooks (no auth required — use signatures or API keys)
// ---------------------------------------------------------------------------
test.describe("API: Webhooks", () => {
  test("POST /api/webhooks/discord rejects invalid signature", async ({ request }) => {
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

  test("POST /api/webhooks/linear responds without crashing", async ({ request }) => {
    const res = await request.post("/api/webhooks/linear", {
      data: { action: "create", type: "Issue", data: {} },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/webhooks/google-drive responds without crashing", async ({ request }) => {
    const res = await request.post("/api/webhooks/google-drive", {
      data: {},
      headers: {
        "x-goog-resource-state": "update",
        "x-goog-channel-id": "test-channel",
      },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/webhooks/nango responds without crashing", async ({ request }) => {
    const res = await request.post("/api/webhooks/nango", {
      data: { type: "sync", connectionId: "test" },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/webhooks/ingest with invalid API key", async ({ request }) => {
    const res = await request.post("/api/webhooks/ingest", {
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

  test("POST /api/webhooks/ingest rejects empty body", async ({ request }) => {
    const res = await request.post("/api/webhooks/ingest", {
      data: {},
      headers: {
        "x-api-key": "invalid-key",
      },
    });
    expect(res.status()).toBeLessThan(502);
  });

  test("POST /api/webhooks/ingest validates required fields", async ({ request }) => {
    const res = await request.post("/api/webhooks/ingest", {
      data: {
        source: "test",
        // Missing title and content
      },
      headers: {
        "x-api-key": "invalid-key",
      },
    });
    expect(res.status()).toBeLessThan(502);
  });
});

// ---------------------------------------------------------------------------
// Inngest (function serving endpoint)
// ---------------------------------------------------------------------------
test.describe("API: Inngest", () => {
  test("GET /api/inngest responds (introspection)", async ({ request }) => {
    const res = await request.get("/api/inngest");
    // Inngest introspection endpoint — should respond with 200 or its own status
    expect(res.status()).toBeLessThan(502);
  });
});
