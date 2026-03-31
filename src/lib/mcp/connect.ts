import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

export interface MCPConnection {
  client: MCPClient;
  tools: Record<string, unknown>;
  toolNames: string[];
}

export async function connectMCPServer(options: {
  url: string;
  apiKey?: string;
  transportType?: "http" | "sse";
}): Promise<MCPConnection> {
  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const client = await createMCPClient({
    transport: {
      type: options.transportType ?? "http",
      url: options.url,
      headers,
    },
  });

  const tools = await client.tools();
  const toolNames = Object.keys(tools);

  return { client, tools, toolNames };
}

export async function testMCPConnection(
  url: string,
  apiKey?: string,
  transportType?: "http" | "sse"
): Promise<{
  success: boolean;
  toolCount: number;
  toolNames: string[];
  error?: string;
}> {
  try {
    const conn = await connectMCPServer({ url, apiKey, transportType });
    const result = {
      success: true,
      toolCount: conn.toolNames.length,
      toolNames: conn.toolNames,
    };
    await conn.client.close();
    return result;
  } catch (err) {
    return {
      success: false,
      toolCount: 0,
      toolNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
