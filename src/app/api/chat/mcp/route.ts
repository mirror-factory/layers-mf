import { NextRequest } from "next/server";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

const MCP_SYSTEM_PROMPT = `You help users discover and connect MCP (Model Context Protocol) tool servers. You can search registries, explain what each server does, and help connect or disconnect them.

When the user asks to find or connect a tool:
1. Use search_mcp_servers to find matching servers
2. Present the options clearly with name, description, and auth type
3. When the user chooses one, use connect_mcp_server to set it up
4. If the user pastes a URL directly, use connect_mcp_server immediately

When the user asks to disconnect a server, use disconnect_mcp_server.
When the user asks what's connected, use list_mcp_servers.

Be concise and helpful. Focus only on MCP server management.`;

const MODEL_ID = "google/gemini-3-flash";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const uiMessages: UIMessage[] = body.messages;

  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  const orgId = member.org_id;
  const allTools = createTools(supabase, orgId, user.id);

  // Only expose MCP-related tools
  const mcpTools = {
    search_mcp_servers: allTools.search_mcp_servers,
    connect_mcp_server: allTools.connect_mcp_server,
    disconnect_mcp_server: allTools.disconnect_mcp_server,
    list_mcp_servers: allTools.list_mcp_servers,
  };

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: gateway(MODEL_ID),
    system: MCP_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: mcpTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
