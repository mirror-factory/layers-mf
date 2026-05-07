import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLibraryItem: vi.fn(),
  createMcpImportBatch: vi.fn(),
  createMcpSyncRule: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireUserAndOrg: vi.fn().mockResolvedValue({
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
    orgId: "org-1",
  }),
  isAuthFailure: (value: unknown) => Boolean(value && typeof value === "object" && "response" in value),
}));

vi.mock("@/lib/library/domain", async () => {
  const actual = await vi.importActual<typeof import("@/lib/library/domain")>("@/lib/library/domain");
  return {
    ...actual,
    createLibraryItem: mocks.createLibraryItem,
    createMcpImportBatch: mocks.createMcpImportBatch,
    createMcpSyncRule: mocks.createMcpSyncRule,
  };
});

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/mcp/ingestion", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp/ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMcpImportBatch.mockResolvedValue({ batch: { id: "batch-1" } });
    mocks.createLibraryItem.mockResolvedValue({ item: { id: "ctx-1", title: "Saved" } });
    mocks.createMcpSyncRule.mockResolvedValue({ syncRule: { id: "rule-1" } });
  });

  it("records live lookup without saving Library Items", async () => {
    const response = await POST(request({
      mode: "live_lookup",
      mcpServerId: "mcp-1",
      query: "latest issues",
      resultPreview: [{ title: "Issue" }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.createLibraryItem).not.toHaveBeenCalled();
    expect(mocks.createMcpImportBatch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      mode: "live_lookup",
      status: "completed",
    }));
    expect(mocks.createMcpImportBatch.mock.calls[0]?.[1]).not.toHaveProperty("savedCount");
  });

  it("saves selected MCP records as Library Items", async () => {
    const response = await POST(request({
      mode: "save_selected",
      mcpServerId: "mcp-1",
      provider: "linear",
      query: "library layer",
      records: [
        { id: "LIN-1", title: "Implement Library", content: "Build the thing", url: "https://linear.test/LIN-1" },
        { id: "LIN-2", title: "Test Library", body: "Verify the thing" },
      ],
      stackIds: ["stack-1"],
    }));

    expect(response.status).toBe(200);
    expect(mocks.createLibraryItem).toHaveBeenCalledTimes(2);
    expect(mocks.createLibraryItem).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orgId: "org-1",
      title: "Implement Library",
      source: expect.objectContaining({
        sourceKind: "mcp",
        provider: "linear",
        importMode: "save_selected",
      }),
    }));
    expect(mocks.createMcpImportBatch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      mode: "save_selected",
      selectedCount: 2,
      savedCount: 2,
    }));
  });

  it("creates durable sync rules explicitly", async () => {
    const response = await POST(request({
      mode: "sync_rule",
      mcpServerId: "mcp-1",
      name: "Linear Library Layer issues",
      toolName: "search_issues",
      query: "project:Layers label:library",
      destinationStackId: "stack-1",
      cadence: "0 * * * *",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createMcpSyncRule).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orgId: "org-1",
      userId: "user-1",
      mcpServerId: "mcp-1",
      name: "Linear Library Layer issues",
    }));
  });

  it("rejects malformed selected records before import", async () => {
    const response = await POST(request({
      mode: "save_selected",
      records: [{ id: "missing-title" }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.createLibraryItem).not.toHaveBeenCalled();
  });
});
