import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { buildLayersMcpToolList, callLayersMcpTool } from "@/lib/library/layers-mcp";

export async function GET() {
  return NextResponse.json({
    name: "layers-library",
    protocol: "mcp-json-rpc-lite",
    tools: buildLayersMcpToolList(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const message = await request.json().catch(() => null);
  if (!message || typeof message !== "object") {
    return NextResponse.json({ error: "Invalid JSON-RPC message" }, { status: 400 });
  }

  const id = message.id ?? null;
  const method = message.method;

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "layers-library", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    });
  }

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: buildLayersMcpToolList().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      },
    });
  }

  if (method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    const result = await callLayersMcpTool(
      auth.supabase,
      { orgId: auth.orgId, userId: auth.user.id },
      name,
      args,
    );

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  }, { status: 404 });
}
