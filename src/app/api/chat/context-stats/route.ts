import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRules, formatRulesForPrompt } from "@/lib/ai/priority-docs";
import {
  estimateTokens,
  getContextWindow,
  getPricing,
} from "@/lib/ai/token-counter";

/**
 * GET /api/chat/context-stats
 *
 * Returns token estimates for the server-side context components
 * (system prompt, rules, tool definitions) so the client can show
 * an accurate context window breakdown.
 *
 * Query params:
 *   modelId — the current model (for context window + pricing)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("modelId") ?? "anthropic/claude-haiku-4-5-20251001";

  // Load org rules
  const orgRules = await loadRules(supabase, member.org_id);
  const rulesText = formatRulesForPrompt(orgRules);

  // The AGENT_INSTRUCTIONS is ~4200 chars. We estimate it rather than importing
  // to avoid pulling in the full chat route module.
  const systemPromptTokens = 1050;
  const rulesTokens = estimateTokens(rulesText);

  // Tool definitions: ~25 built-in tools × ~120 tokens each = ~3000
  // MCP tools vary, but we estimate ~2000 for typical setups
  const toolsTokens = 3000;

  // Count active MCP servers for a better tools estimate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: mcpCount } = await (supabase as any)
    .from("mcp_servers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", member.org_id)
    .eq("is_active", true);

  const mcpToolsTokens = (mcpCount ?? 0) * 1500; // ~1500 tokens per MCP server's tools

  const totalToolsTokens = toolsTokens + mcpToolsTokens;
  const totalFixed = systemPromptTokens + rulesTokens + totalToolsTokens;

  const contextWindow = getContextWindow(modelId);
  const pricing = getPricing(modelId);

  return NextResponse.json({
    systemPromptTokens,
    rulesTokens,
    rulesCount: orgRules.length,
    toolsTokens: totalToolsTokens,
    builtInToolsTokens: toolsTokens,
    mcpToolsTokens,
    mcpServerCount: mcpCount ?? 0,
    totalFixedTokens: totalFixed,
    contextWindow,
    availableForHistory: contextWindow - totalFixed,
    pricing,
  });
}
