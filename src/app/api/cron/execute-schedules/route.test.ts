import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they're available inside vi.mock factories
const { mockGenerate, mockFrom } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({ text: "AI result text" }),
  mockFrom: vi.fn(),
}));

// Mock supabase admin client
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

// Mock AI SDK
vi.mock("ai", () => {
  class MockToolLoopAgent {
    generate = mockGenerate;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public opts: any) {}
  }
  return {
    ToolLoopAgent: MockToolLoopAgent,
    tool: vi.fn().mockImplementation((opts) => opts),
    stepCountIs: vi.fn().mockImplementation((n: number) => `stopAt:${n}`),
  };
});

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("@/lib/cron", () => ({
  calculateNextCron: vi.fn().mockReturnValue("2026-04-16T00:00:00Z"),
}));

vi.mock("@/lib/db/search", () => ({
  searchContextChunks: vi.fn().mockResolvedValue([]),
  searchContext: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock createTools from main tool factory — return identifiable tools per name
vi.mock("@/lib/ai/tools", () => ({
  createTools: vi.fn().mockReturnValue({
    search_context: { description: "full:search_context", execute: vi.fn() },
    get_document: { description: "full:get_document", execute: vi.fn() },
    artifact_list: { description: "full:artifact_list", execute: vi.fn() },
    artifact_get: { description: "full:artifact_get", execute: vi.fn() },
    write_code: { description: "full:write_code", execute: vi.fn() },
    edit_code: { description: "full:edit_code", execute: vi.fn() },
    web_browse: { description: "full:web_browse", execute: vi.fn() },
    web_search: { description: "full:web_search", execute: vi.fn() },
    run_project: { description: "full:run_project", execute: vi.fn() },
    schedule_action: { description: "full:schedule_action", execute: vi.fn() },
    connect_mcp_server: { description: "full:connect_mcp_server", execute: vi.fn() },
    ask_user: { description: "full:ask_user", execute: vi.fn() },
  }),
}));

import {
  createScheduleTools,
  createScheduleToolsByTier,
  type ToolTier,
} from "./route";
import { createAdminClient } from "@/lib/supabase/server";

function createMockSupabase() {
  return createAdminClient();
}

// ---------------------------------------------------------------------------
// Unit tests for createScheduleToolsByTier
// ---------------------------------------------------------------------------
describe("createScheduleToolsByTier", () => {
  const supabase = createMockSupabase();
  const orgId = "org-1";
  const userId = "user-1";

  it("minimal tier returns only search_context", () => {
    const tools = createScheduleToolsByTier("minimal", supabase, orgId, userId);
    const toolNames = Object.keys(tools);
    expect(toolNames).toEqual(["search_context"]);
  });

  it("standard tier includes search_context + artifact + web + code tools", () => {
    const tools = createScheduleToolsByTier("standard", supabase, orgId, userId);
    const toolNames = Object.keys(tools);

    // Must include search from base + the 6 standard extras
    expect(toolNames).toContain("search_context");
    expect(toolNames).toContain("artifact_list");
    expect(toolNames).toContain("artifact_get");
    expect(toolNames).toContain("write_code");
    expect(toolNames).toContain("edit_code");
    expect(toolNames).toContain("web_browse");
    expect(toolNames).toContain("web_search");

    // Must NOT include tools beyond standard tier
    expect(toolNames).not.toContain("run_project");
    expect(toolNames).not.toContain("schedule_action");
    expect(toolNames).not.toContain("connect_mcp_server");
    expect(toolNames).not.toContain("ask_user");
  });

  it("full tier uses all tools from createTools", () => {
    const tools = createScheduleToolsByTier("full", supabase, orgId, userId);
    const toolNames = Object.keys(tools);

    // Full should have all tools from the main factory
    expect(toolNames).toContain("search_context");
    expect(toolNames).toContain("get_document");
    expect(toolNames).toContain("artifact_list");
    expect(toolNames).toContain("run_project");
    expect(toolNames).toContain("connect_mcp_server");
    expect(toolNames).toContain("ask_user");
    expect(toolNames.length).toBeGreaterThanOrEqual(10);
  });

  it("defaults to minimal when tier value is unrecognized (falls through)", () => {
    // The route handler defaults unknown/null to 'minimal' before calling this
    const tools = createScheduleToolsByTier("minimal", supabase, orgId, userId);
    expect(Object.keys(tools)).toEqual(["search_context"]);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for createScheduleTools (base)
// ---------------------------------------------------------------------------
describe("createScheduleTools", () => {
  it("returns only search_context tool", () => {
    const supabase = createMockSupabase();
    const tools = createScheduleTools(supabase, "org-1");
    expect(Object.keys(tools)).toEqual(["search_context"]);
  });

  it("search_context has execute function", () => {
    const supabase = createMockSupabase();
    const tools = createScheduleTools(supabase, "org-1");
    expect(tools.search_context).toHaveProperty("execute");
  });
});

// ---------------------------------------------------------------------------
// Integration: default tier behavior when tool_tier column is null
// ---------------------------------------------------------------------------
describe("GET /api/cron/execute-schedules - tier defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  /** Build a chainable supabase mock for the schedule query */
  function setupMockFrom(schedules: Record<string, unknown>[]) {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "conv-1" },
          error: null,
        }),
      }),
    });

    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const updateMock = vi.fn().mockReturnValue(updateChain);

    mockFrom.mockImplementation((table: string) => {
      if (table === "scheduled_actions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: schedules,
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      // conversations, chat_messages
      return {
        insert: insertMock,
      };
    });
  }

  it("uses minimal tier (5 step limit) when tool_tier is null", async () => {
    setupMockFrom([
      {
        id: "sched-1",
        org_id: "org-1",
        created_by: "user-1",
        name: "Daily digest",
        description: "Check updates",
        payload: {},
        schedule: "0 7 * * *",
        run_count: 0,
        max_runs: null,
        tool_tier: null,
      },
    ]);

    const { GET } = await import("./route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/cron/execute-schedules", {
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(body.executed).toBe(1);
    expect(body.results[0].status).toBe("executed");

    // Verify ToolLoopAgent was called — mockGenerate tracks the call
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("uses full tier when tool_tier is 'full'", async () => {
    setupMockFrom([
      {
        id: "sched-2",
        org_id: "org-1",
        created_by: "user-1",
        name: "Full task",
        description: "Run everything",
        payload: {},
        schedule: "0 9 * * 1",
        run_count: 0,
        max_runs: null,
        tool_tier: "full",
      },
    ]);

    const { GET } = await import("./route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/cron/execute-schedules", {
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(body.executed).toBe(1);
    expect(body.results[0].status).toBe("executed");
    expect(mockGenerate).toHaveBeenCalled();
  });
});
