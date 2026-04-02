import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createAdminClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";
import { logUsage } from "@/lib/ai/usage";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";

const WEBHOOK_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff. You are responding via an external platform webhook (Discord, Slack, or custom integration).

## Your Tools
You have access to context search and document tools:
- search_context — search documents, meetings, notes in the knowledge base
- get_document — fetch full content of a specific document by ID

## Guidelines
- Always call search_context before answering questions — do not rely on training data alone
- Be concise — external platforms often have message length limits
- Lead with the answer, then explain
- Cite sources by name and date: [Source: title (date)]
- All write actions must go through the approval queue — never execute directly
- If a tool returns "not configured", tell the user to check Settings`;

// ---------------------------------------------------------------------------
// Auth: verify webhook secret from header or body
// ---------------------------------------------------------------------------

function authenticateWebhook(request: NextRequest, body: Record<string, unknown>): boolean {
  const envSecret = process.env.CHAT_SDK_WEBHOOK_SECRET;
  if (!envSecret) return false;

  const headerSecret = request.headers.get("x-webhook-secret");
  const bodySecret = body.webhookSecret as string | undefined;

  return headerSecret === envSecret || bodySecret === envSecret;
}

// ---------------------------------------------------------------------------
// Resolve org from webhook config or fallback to default
// ---------------------------------------------------------------------------

async function resolveOrg(): Promise<{ orgId: string; userId: string } | null> {
  const supabase = createAdminClient();

  // Use the first org as the webhook org (single-tenant for now)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("org_members")
    .select("org_id, user_id")
    .limit(1)
    .single();

  if (!member) return null;

  return {
    orgId: member.org_id as string,
    userId: member.user_id as string,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Handle test requests (no auth required for test pings from settings UI)
  if (body.type === "test") {
    const envSecret = process.env.CHAT_SDK_WEBHOOK_SECRET;
    if (!envSecret) {
      return NextResponse.json({
        ok: true,
        warning: "CHAT_SDK_WEBHOOK_SECRET env var not set. Set it to secure this endpoint.",
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Authenticate real requests
  if (!authenticateWebhook(request, body)) {
    return NextResponse.json({ error: "Unauthorized — invalid webhook secret" }, { status: 401 });
  }

  // Extract message
  const message = (body.message as string) ?? (body.text as string) ?? "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Missing 'message' or 'text' field" }, { status: 400 });
  }

  const platform = (body.platform as string) ?? "webhook";
  const externalUserId = (body.userId as string) ?? (body.user_id as string) ?? "anonymous";
  const callbackUrl = (body.callbackUrl as string) ?? (body.callback_url as string) ?? null;

  // Resolve org
  const org = await resolveOrg();
  if (!org) {
    return NextResponse.json({ error: "No organization configured" }, { status: 500 });
  }

  const { orgId, userId } = org;
  const supabase = createAdminClient();
  const tools = createTools(supabase, orgId);

  // Inject date/time context
  const now = new Date();
  const dateTimeContext = `\n\n## Current Date & Time\nToday is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. The current time is ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.\n`;

  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let runStepCount = 0;
  const toolCallCounts: Record<string, number> = {};

  try {
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system: WEBHOOK_INSTRUCTIONS + dateTimeContext,
      messages: [{ role: "user" as const, content: message }],
      tools,
      stopWhen: stepCountIs(8),
      onStepFinish: ({ usage, toolCalls }) => {
        runStepCount++;
        if (usage) {
          totalInputTokens += usage.inputTokens ?? 0;
          totalOutputTokens += usage.outputTokens ?? 0;
        }
        if (toolCalls) {
          for (const tc of toolCalls) {
            const name = tc.toolName ?? "unknown";
            toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1;
          }
        }
      },
    });

    const responseText = text || "I processed your request but had no text response.";

    // Log usage (fire-and-forget)
    logUsage({
      orgId,
      userId,
      operation: "chat-webhook",
      model: DEFAULT_MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      creditsUsed: 1,
      metadata: {
        platform,
        externalUserId,
        stepCount: runStepCount,
        durationMs: Date.now() - startTime,
        toolCalls: Object.entries(toolCallCounts).map(([tool, count]) => ({ tool, count })),
      },
    });

    // Store messages (fire-and-forget)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("chat_messages")
      .insert([
        {
          org_id: orgId,
          user_id: userId,
          session_id: null,
          conversation_id: null,
          channel: platform,
          role: "user",
          content: [{ type: "text", text: message }] as unknown as Json,
          model: null,
        },
        {
          org_id: orgId,
          user_id: userId,
          session_id: null,
          conversation_id: null,
          channel: platform,
          role: "assistant",
          content: [{ type: "text", text: responseText }] as unknown as Json,
          model: DEFAULT_MODEL,
        },
      ])
      .then(() => {});

    // If a callback URL is provided, also POST the response there (fire-and-forget)
    if (callbackUrl) {
      void fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: responseText,
          platform,
          externalUserId,
          model: DEFAULT_MODEL,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            stepCount: runStepCount,
          },
        }),
      }).catch((err) => {
        console.error("[chat-sdk/webhook] callback delivery failed:", err);
      });
    }

    return NextResponse.json({
      response: responseText,
      model: DEFAULT_MODEL,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        stepCount: runStepCount,
        durationMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error("[chat-sdk/webhook] agent error:", err);
    return NextResponse.json(
      {
        error: "Agent processing failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
