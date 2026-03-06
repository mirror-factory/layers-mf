import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { searchContext, buildContextBlock } from "@/lib/db/search";

export const maxDuration = 60;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
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

  const body = await request.json();
  const uiMessages: UIMessage[] = body.messages ?? [];

  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  // Extract last user message text for retrieval
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
  const queryText = lastUserMsg?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join(" ") ?? "";

  // Retrieve relevant context
  let contextBlock = "No context available.";
  if (queryText) {
    try {
      const results = await searchContext(supabase, member.org_id, queryText);
      contextBlock = buildContextBlock(results);
    } catch {
      // Non-fatal: proceed without context
    }
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: `You are Layers, an AI assistant for knowledge teams. You help users understand their documents, meetings, and projects.

You have access to the following context from the team's knowledge base:

<context>
${contextBlock}
</context>

Answer questions using the context above when relevant. Be concise and specific. If the context doesn't contain relevant information, say so and answer from your general knowledge.`,
    messages: await convertToModelMessages(uiMessages),
  });

  return result.toUIMessageStreamResponse();
}
