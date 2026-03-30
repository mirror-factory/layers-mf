import { NextRequest } from "next/server";
import { generateText } from "ai";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/discord/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/synthesis
 * Nightly synthesis cron — 2 AM UTC.
 * Opus 4.6 reviews 30 days of context to find patterns,
 * recurring themes, and strategic insights.
 * Result stored as a context_item (compound knowledge loop).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get org
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .limit(1)
    .single();

  if (!org) {
    return Response.json({ error: "No org found" }, { status: 500 });
  }

  // Fetch 30 days of context summaries (not full content — budget-conscious)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: items } = await supabase
    .from("context_items")
    .select(
      "title, description_short, description_long, source_type, content_type, entities, ingested_at"
    )
    .eq("org_id", org.id)
    .eq("status", "ready")
    .gte("ingested_at", thirtyDaysAgo)
    .order("ingested_at", { ascending: false })
    .limit(100); // Cap for cost control

  if (!items?.length) {
    return Response.json({ message: "No context to synthesize" });
  }

  // Build context summary for the synthesis prompt
  const contextSummary = items
    .map((item, i) => {
      const entities = item.entities as Record<string, string[]> | null;
      const entityStr = entities
        ? `People: ${(entities.people ?? []).join(", ")} | Topics: ${(entities.topics ?? []).join(", ")} | Actions: ${(entities.action_items ?? []).length} | Decisions: ${(entities.decisions ?? []).length}`
        : "";
      return `[${i + 1}] ${item.title} (${item.source_type}/${item.content_type}, ${new Date(item.ingested_at).toLocaleDateString()})
${item.description_short ?? ""}
${entityStr}`;
    })
    .join("\n\n");

  // Run synthesis with Opus (flagship model per TASK_MODELS)
  const { text, usage } = await generateText({
    model: gateway(TASK_MODELS.synthesis),
    maxTokens: 4000,
    prompt: `You are Granger, Mirror Factory's AI chief of staff. Analyze the past 30 days of team context and produce a strategic synthesis.

## Context Library (${items.length} items from last 30 days)

${contextSummary}

## Synthesis Task

Analyze all context and identify:

1. **Recurring Unresolved Topics**: Topics that appear in 3+ items without resolution. Why are they stuck?
2. **Decision Patterns**: What types of decisions are being made quickly vs slowly? Any bottlenecks?
3. **Action Item Completion**: Are action items from meetings being completed or repeatedly deferred?
4. **Strategic Blind Spots**: What important topics are NOT being discussed that should be, based on stated priorities?
5. **Relationship Dynamics**: How are client relationships evolving? Any at risk?
6. **Resource Allocation**: Is the team's time aligned with stated priorities?
7. **Key Recommendations**: Top 3 actionable recommendations for the next 2 weeks.

Be specific. Cite source items by title and date. Don't hedge — state your assessment clearly.`,
  });

  // Store synthesis as a context_item (compound knowledge loop)
  const { data: synthItem } = await supabase
    .from("context_items")
    .insert({
      org_id: org.id,
      source_type: "synthesis",
      source_id: `synthesis-${new Date().toISOString().split("T")[0]}`,
      content_type: "document",
      title: `Granger Synthesis — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      description_short:
        "AI-generated strategic synthesis of the past 30 days of team context.",
      raw_content: text,
      status: "ready",
      ingested_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      priority_weight: 50,
    })
    .select("id")
    .single();

  // Post teaser to Discord alerts channel if configured
  const alertsChannelId = process.env.DISCORD_ALERTS_CHANNEL_ID;
  if (alertsChannelId && text) {
    const teaser = text.split("\n").slice(0, 10).join("\n").slice(0, 1800);
    await sendMessage(
      alertsChannelId,
      `**Nightly Synthesis Complete**\n\n${teaser}\n\n_Full synthesis available in the context library._`
    );
  }

  const promptTokens = usage?.promptTokens ?? 0;
  const completionTokens = usage?.completionTokens ?? 0;
  const costEstimate = (
    (promptTokens * 0.015) / 1000 +
    (completionTokens * 0.075) / 1000
  ).toFixed(3);

  return Response.json({
    id: synthItem?.id,
    tokens: { input: promptTokens, output: completionTokens },
    cost_estimate: `~$${costEstimate}`,
  });
}

// Vercel cron hits GET by default
export async function GET(request: NextRequest) {
  return POST(request);
}
