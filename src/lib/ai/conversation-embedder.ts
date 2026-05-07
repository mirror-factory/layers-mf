import { generateText } from "ai";
import { gateway } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/server";

const SUMMARY_MODEL = "google/gemini-3.1-flash-lite-preview";
const EMBED_AFTER_MESSAGES = 20;

export async function embedConversationIfReady(
  conversationId: string,
  orgId: string
) {
  const supabase = createAdminClient();

  // Count messages
  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (!count || count < EMBED_AFTER_MESSAGES) return;

  // Check if already embedded recently (avoid re-embedding on every message)
  const { data: existing } = await supabase
    .from("context_items")
    .select("id, processed_at")
    .eq("source_type", "conversation")
    .eq("source_id", conversationId)
    .single();

  // Skip if processed in last 30 minutes
  if (existing?.processed_at) {
    const lastUpdate = new Date(existing.processed_at).getTime();
    if (Date.now() - lastUpdate < 30 * 60 * 1000) return;
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!messages || messages.length === 0) return;

  // Build transcript
  const transcript = messages
    .map((m) => {
      const content = m.content as unknown;
      const parts = Array.isArray(content)
        ? (content as { type: string; text?: string }[])
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("\n")
        : String(content);
      return `${m.role === "user" ? "User" : "Assistant"}: ${parts}`;
    })
    .join("\n\n");

  // Get conversation title
  const { data: conv } = await supabase
    .from("conversations")
    .select("title")
    .eq("id", conversationId)
    .single();

  // Summarize
  const { text: summary } = await generateText({
    model: gateway(SUMMARY_MODEL),
    prompt: `Summarize this conversation in 2-3 paragraphs. Include: main topics discussed, key decisions made, artifacts created, action items, and important facts mentioned.\n\n${transcript.slice(0, 10000)}`,
  });

  // Store in context_items using select-then-insert/update pattern
  // (partial unique index on (org_id, source_type, source_id) WHERE source_id IS NOT NULL makes upsert unreliable)
  const now = new Date().toISOString();
  const sourceMetadata = {
    message_count: count,
    last_embedded: now,
  };

  if (existing) {
    await supabase
      .from("context_items")
      .update({
        title: conv?.title || "Untitled conversation",
        raw_content: summary,
        source_metadata: sourceMetadata,
        processed_at: now,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("context_items").insert({
      org_id: orgId,
      source_type: "conversation",
      source_id: conversationId,
      content_type: "document",
      title: conv?.title || "Untitled conversation",
      raw_content: summary,
      source_metadata: sourceMetadata,
      status: "ready",
    });
  }
}
