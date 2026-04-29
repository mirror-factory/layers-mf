import {
  auditExternalCall,
  createContextPack,
  createLibraryItem,
  createStack,
  getLibraryItem,
  listContextPacks,
  listLibraryItems,
  listStacks,
  proposeAction,
  saveLibraryAsset,
} from "./domain";
import type { LayersMcpToolName } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type LayersMcpToolDefinition = {
  name: LayersMcpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: "read" | "write" | "risky_write";
};

const stringProp = { type: "string" } as const;
const objectProp = { type: "object", additionalProperties: true } as const;

export function buildLayersMcpToolList(): LayersMcpToolDefinition[] {
  return [
    {
      name: "search_library",
      description: "Search permission-scoped Library Items.",
      risk: "read",
      inputSchema: {
        type: "object",
        properties: {
          query: stringProp,
          limit: { type: "number", minimum: 1, maximum: 50 },
          itemType: stringProp,
          stackId: stringProp,
        },
        required: ["query"],
      },
    },
    {
      name: "get_library_item",
      description: "Fetch a Library Item with stacks, tags, assets, sources, and relationships.",
      risk: "read",
      inputSchema: {
        type: "object",
        properties: { id: stringProp },
        required: ["id"],
      },
    },
    {
      name: "add_library_item",
      description: "Create a durable Library Item.",
      risk: "write",
      inputSchema: {
        type: "object",
        properties: {
          title: stringProp,
          body: stringProp,
          summary: stringProp,
          itemType: stringProp,
          source: objectProp,
          stackIds: { type: "array", items: stringProp },
          tags: { type: "array", items: stringProp },
        },
        required: ["title"],
      },
    },
    {
      name: "list_stacks",
      description: "List Library Stacks.",
      risk: "read",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "create_stack",
      description: "Create a Library Stack.",
      risk: "write",
      inputSchema: {
        type: "object",
        properties: {
          name: stringProp,
          description: stringProp,
          icon: stringProp,
          color: stringProp,
        },
        required: ["name"],
      },
    },
    {
      name: "save_asset",
      description: "Save an image, file, generated media, screenshot, or artifact preview asset.",
      risk: "write",
      inputSchema: {
        type: "object",
        properties: {
          kind: stringProp,
          title: stringProp,
          originalUrl: stringProp,
          storageBucket: stringProp,
          storagePath: stringProp,
          mimeType: stringProp,
          caption: stringProp,
          ocrText: stringProp,
          metadata: objectProp,
        },
      },
    },
    {
      name: "ask_dewey",
      description: "Ask Dewey to answer from Library context. This returns a retrieval plan and context, not an LLM completion.",
      risk: "read",
      inputSchema: {
        type: "object",
        properties: {
          question: stringProp,
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
        required: ["question"],
      },
    },
    {
      name: "create_context_pack",
      description: "Create a scoped context pack for handoff to an external tool or agent.",
      risk: "write",
      inputSchema: {
        type: "object",
        properties: {
          name: stringProp,
          purpose: stringProp,
          itemIds: { type: "array", items: stringProp },
          instructions: stringProp,
          visibility: stringProp,
        },
        required: ["name"],
      },
    },
    {
      name: "list_context_packs",
      description: "List context packs.",
      risk: "read",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "create_artifact",
      description: "Create an artifact. Currently routed through approval until external write policy is finalized.",
      risk: "risky_write",
      inputSchema: objectProp,
    },
    {
      name: "run_sandbox",
      description: "Run sandboxed code. Currently routed through approval until external write policy is finalized.",
      risk: "risky_write",
      inputSchema: objectProp,
    },
    {
      name: "propose_action",
      description: "Propose an action for human approval.",
      risk: "risky_write",
      inputSchema: {
        type: "object",
        properties: {
          actionType: stringProp,
          targetService: stringProp,
          payload: objectProp,
          reasoning: stringProp,
        },
        required: ["actionType", "targetService", "payload"],
      },
    },
    {
      name: "execute_approved_action",
      description: "Execute an already-approved action. Stubbed until action executor policy is connected.",
      risk: "risky_write",
      inputSchema: {
        type: "object",
        properties: { approvalId: stringProp },
        required: ["approvalId"],
      },
    },
  ];
}

export async function callLayersMcpTool(
  supabase: AnySupabase,
  context: { orgId: string; userId?: string },
  toolName: string,
  args: Record<string, any>,
) {
  const tool = buildLayersMcpToolList().find((item) => item.name === toolName);
  if (!tool) return { error: `Unknown tool: ${toolName}` };

  await auditExternalCall(supabase, {
    orgId: context.orgId,
    userId: context.userId,
    actorType: "external_client",
    direction: "inbound",
    toolName,
    requestSummary: JSON.stringify(args).slice(0, 500),
    status: tool.risk === "risky_write" ? "approval_required" : "ok",
  });

  switch (tool.name) {
    case "search_library":
      return listLibraryItems(supabase, context.orgId, {
        query: args.query,
        limit: args.limit,
        itemType: args.itemType,
        stackId: args.stackId,
      });
    case "get_library_item":
      return getLibraryItem(supabase, context.orgId, args.id);
    case "add_library_item":
      return createLibraryItem(supabase, {
        orgId: context.orgId,
        userId: context.userId,
        title: args.title,
        body: args.body,
        summary: args.summary,
        itemType: args.itemType,
        source: args.source,
        stackIds: args.stackIds,
        tags: args.tags,
        assets: args.assets,
      });
    case "list_stacks":
      return listStacks(supabase, context.orgId);
    case "create_stack":
      if (!context.userId) return { error: "User context required" };
      return createStack(supabase, {
        orgId: context.orgId,
        userId: context.userId,
        name: args.name,
        description: args.description,
        icon: args.icon,
        color: args.color,
      });
    case "save_asset":
      return saveLibraryAsset(supabase, context.orgId, context.userId, args);
    case "ask_dewey": {
      const results = await listLibraryItems(supabase, context.orgId, {
        query: args.question,
        limit: args.limit ?? 8,
      });
      return {
        answerMode: "retrieval_context",
        note: "Dewey should answer with citations from these Library results.",
        ...results,
      };
    }
    case "create_context_pack":
      return createContextPack(supabase, {
        orgId: context.orgId,
        userId: context.userId,
        name: args.name,
        purpose: args.purpose,
        visibility: args.visibility,
        instructions: args.instructions,
        itemIds: args.itemIds,
        metadata: args.metadata,
      });
    case "list_context_packs":
      return listContextPacks(supabase, context.orgId);
    case "create_artifact":
    case "run_sandbox":
      return proposeAction(supabase, {
        orgId: context.orgId,
        requestedByAgent: "dewey",
        actionType: tool.name,
        targetService: tool.name === "run_sandbox" ? "sandbox" : "artifacts",
        payload: args,
        reasoning: "External MCP client requested a risky write.",
      });
    case "propose_action":
      return proposeAction(supabase, {
        orgId: context.orgId,
        requestedByAgent: "dewey",
        actionType: args.actionType,
        targetService: args.targetService,
        payload: args.payload,
        reasoning: args.reasoning,
        conflictReason: args.conflictReason,
      });
    case "execute_approved_action":
      return {
        status: "not_implemented",
        approvalId: args.approvalId,
        reason: "Execution must be connected to the approval/action executor in a dedicated action-layer pass.",
      };
  }
}
