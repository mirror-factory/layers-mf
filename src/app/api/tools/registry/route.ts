import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOL_METADATA } from "@/lib/ai/tools/_metadata";
import type { ToolMetadata } from "@/lib/ai/tools/_types";

/* ------------------------------------------------------------------ */
/*  Map ToolMetadata to the API shape                                   */
/* ------------------------------------------------------------------ */

interface BuiltInTool {
  name: string;
  category: string;
  description: string;
  service: string;
  access: string;
  clientSide: boolean;
  status: "active";
}

function toBuiltInTool(m: ToolMetadata): BuiltInTool {
  return {
    name: m.name,
    category: m.category,
    description: m.description,
    service: m.service,
    access: m.access,
    clientSide: m.clientSide ?? false,
    status: "active",
  };
}

const BUILT_IN_TOOLS: BuiltInTool[] = TOOL_METADATA.map(toBuiltInTool);

/* ------------------------------------------------------------------ */
/*  GET /api/tools/registry                                            */
/* ------------------------------------------------------------------ */

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve org
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminDb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (adminDb as any)
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  const orgId = member?.org_id as string | undefined;

  // Fetch MCP servers
  let mcpServers: { serverName: string; tools: string[] }[] = [];
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: servers } = await (adminDb as any)
      .from("mcp_servers")
      .select("name, discovered_tools")
      .eq("org_id", orgId)
      .eq("status", "connected");

    mcpServers = (servers ?? []).map(
      (s: { name: string; discovered_tools: string[] | null }) => ({
        serverName: s.name,
        tools: s.discovered_tools ?? [],
      }),
    );
  }

  // Fetch skills
  let skills: { name: string; slug: string; tools: string[] }[] = [];
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: skillRows } = await (adminDb as any)
      .from("skills")
      .select("name, slug, tools, is_active")
      .eq("org_id", orgId)
      .eq("is_active", true);

    skills = (skillRows ?? []).map(
      (s: {
        name: string;
        slug: string;
        tools: { name: string }[] | null;
      }) => ({
        name: s.name,
        slug: s.slug,
        tools: (s.tools ?? []).map((t) => t.name),
      }),
    );
  }

  return NextResponse.json({
    builtIn: BUILT_IN_TOOLS,
    mcp: mcpServers,
    skills,
  });
}
