import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const { mockAdminFrom, mockExtract, mockEmbed, mockCreateInbox } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockExtract: vi.fn(),
  mockEmbed: vi.fn(),
  mockCreateInbox: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock("@/lib/ai/extract", () => ({
  extractStructured: mockExtract,
}));

vi.mock("@/lib/ai/embed", () => ({
  generateEmbedding: mockEmbed,
}));

vi.mock("@/lib/inbox", () => ({
  createInboxItems: mockCreateInbox,
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: vi.fn() },
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

const WEBHOOK_SECRET = "test-linear-webhook-secret";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(body: unknown, secret?: string): NextRequest {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) {
    headers["linear-signature"] = sign(rawBody, secret);
  }

  return new NextRequest("http://localhost:3000/api/webhooks/linear", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function mockIntegrationLookup(orgId = "org-1") {
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: orgId, nango_connection_id: "conn-1" },
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-1" }, error: null }),
      }),
    }),
  });
}

function mockDbForProcessing() {
  const selectChain = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-1", nango_connection_id: "conn-1" },
            }),
          }),
        }),
      }),
    }),
  };

  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "ci-1" }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  });

  mockExtract.mockResolvedValue({
    title: "Extracted title",
    description_short: "Short desc",
    description_long: "Long desc",
    entities: { people: [] },
  });
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
  mockCreateInbox.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LINEAR_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

describe("POST /api/webhooks/linear", () => {
  it("returns 500 when LINEAR_WEBHOOK_SECRET is not configured", async () => {
    vi.stubEnv("LINEAR_WEBHOOK_SECRET", "");
    const event = { action: "create", type: "Issue", data: { id: "i-1" }, createdAt: "2026-01-01" };
    const res = await POST(makeRequest(event, "some-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Webhook not configured");
  });

  it("returns 401 when signature is missing", async () => {
    const event = { action: "create", type: "Issue", data: { id: "i-1" }, createdAt: "2026-01-01" };
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns 401 when signature is invalid", async () => {
    const event = { action: "create", type: "Issue", data: { id: "i-1" }, createdAt: "2026-01-01" };
    const req = new NextRequest("http://localhost:3000/api/webhooks/linear", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "linear-signature": "0000000000000000000000000000000000000000000000000000000000000000",
      },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const invalidBody = "not-json{{{";
    const signature = sign(invalidBody, WEBHOOK_SECRET);
    const req = new NextRequest("http://localhost:3000/api/webhooks/linear", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "linear-signature": signature,
      },
      body: invalidBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 200 with { received: true } for valid Issue create event", async () => {
    mockDbForProcessing();
    const event = {
      action: "create",
      type: "Issue",
      data: {
        id: "issue-1",
        identifier: "ENG-42",
        title: "Fix login bug",
        description: "Users cannot log in when using SSO. The OAuth redirect is broken.",
        state: { name: "In Progress" },
        assignee: { name: "Alice" },
        priority: 1,
        labels: [{ name: "bug" }],
        team: { name: "Engineering", key: "ENG" },
        url: "https://linear.app/test/issue/ENG-42",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      organizationId: "org-linear-1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("returns 200 for Comment create event", async () => {
    mockDbForProcessing();
    const event = {
      action: "create",
      type: "Comment",
      data: {
        id: "comment-1",
        body: "This is a comment with enough content to pass the filter check for processing.",
        user: { name: "Bob" },
        issue: { id: "issue-1", identifier: "ENG-42", title: "Fix login bug" },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      organizationId: "org-linear-1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });

  it("returns 200 for Project create event", async () => {
    mockDbForProcessing();
    const event = {
      action: "create",
      type: "Project",
      data: {
        id: "project-1",
        name: "Q1 Roadmap",
        description: "This is the Q1 roadmap project with multiple milestones and deliverables.",
        state: "started",
        url: "https://linear.app/test/project/q1",
        lead: { name: "Carol" },
        progress: 0.5,
        startDate: "2026-01-01",
        targetDate: "2026-03-31",
        createdAt: "2026-01-01T00:00:00Z",
      },
      organizationId: "org-linear-1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
  });

  it("returns 200 for Cycle create event", async () => {
    mockDbForProcessing();
    const event = {
      action: "create",
      type: "Cycle",
      data: {
        id: "cycle-1",
        number: 5,
        name: "Sprint 5",
        description: "Sprint 5 focused on authentication improvements and bug fixes.",
        startsAt: "2026-03-01",
        endsAt: "2026-03-14",
        progress: 0.3,
        team: { name: "Engineering", key: "ENG" },
        createdAt: "2026-03-01T00:00:00Z",
      },
      organizationId: "org-linear-1",
      createdAt: "2026-03-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
  });

  it("returns 200 for remove action (archives context item)", async () => {
    mockDbForProcessing();
    const event = {
      action: "remove",
      type: "Issue",
      data: { id: "issue-to-remove" },
      organizationId: "org-linear-1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
  });

  it("returns 200 for unhandled event type", async () => {
    mockDbForProcessing();
    const event = {
      action: "create",
      type: "UnknownType",
      data: { id: "x-1" },
      organizationId: "org-linear-1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const res = await POST(makeRequest(event, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });
});
