import { describe, expect, it } from "vitest";
import { buildLayersMcpToolList, callLayersMcpTool } from "./layers-mcp";

describe("Layers MCP registry", () => {
  it("exposes the initial Library, Dewey, artifact, sandbox, and approval tools", () => {
    const tools = buildLayersMcpToolList();
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "search_library",
        "get_library_item",
        "add_library_item",
        "list_stacks",
        "create_stack",
        "save_asset",
        "ask_dewey",
        "create_context_pack",
        "list_context_packs",
        "create_artifact",
        "run_sandbox",
        "propose_action",
        "execute_approved_action",
      ]),
    );
  });

  it("marks risky execution tools as approval-gated", () => {
    const tools = buildLayersMcpToolList();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get("search_library")?.risk).toBe("read");
    expect(byName.get("add_library_item")?.risk).toBe("write");
    expect(byName.get("create_artifact")?.risk).toBe("risky_write");
    expect(byName.get("run_sandbox")?.risk).toBe("risky_write");
    expect(byName.get("execute_approved_action")?.risk).toBe("risky_write");
  });

  it("rejects unknown tool calls before touching storage", async () => {
    const result = await callLayersMcpTool(
      {},
      { orgId: "org-1", userId: "user-1" },
      "unknown_tool",
      {},
    );

    expect(result).toEqual({ error: "Unknown tool: unknown_tool" });
  });
});
