import { generateObject } from "ai";
import { SupabaseClient } from "@supabase/supabase-js";
import { extractionModel, embeddingModel } from "@/lib/ai/config";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  ExtractionSchema,
  SessionMatchSchema,
  type ExtractionResult,
} from "./extraction-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export interface ProcessingResult {
  contextItemId: string;
  status: "ready" | "error";
  extraction?: ExtractionResult;
  linkedSessions?: string[];
  error?: string;
}

/**
 * Full context processing pipeline: Extract → Embed → Link.
 *
 * 1. EXTRACT: Pull structured entities from raw content using AI
 * 2. EMBED: Generate vector embedding for semantic search
 * 3. LINK: Match content to active sessions and create links
 */
export async function processContextItem(
  supabase: AnySupabase,
  contextItemId: string,
  orgId: string
): Promise<ProcessingResult> {
  // Fetch the context item
  const { data: item, error: fetchError } = await supabase
    .from("context_items")
    .select("id, raw_content, title, source_type, status")
    .eq("id", contextItemId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !item) {
    return {
      contextItemId,
      status: "error",
      error: fetchError?.message ?? "Context item not found",
    };
  }

  // Mark as processing
  await supabase
    .from("context_items")
    .update({ status: "processing" })
    .eq("id", contextItemId);

  try {
    // Step 1: EXTRACT + Step 2: EMBED (parallel)
    const [extraction, embedding] = await Promise.all([
      extractContent(item.raw_content, item.title),
      generateEmbedding(item.raw_content),
    ]);

    // Update context item with extracted data + embedding
    await supabase
      .from("context_items")
      .update({
        title: extraction.title,
        description_short: extraction.description_short,
        description_long: extraction.description_long,
        entities: extraction.entities,
        embedding: embedding as unknown as string,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", contextItemId);

    // Step 3: LINK to active sessions
    const linkedSessions = await linkToSessions(
      supabase,
      contextItemId,
      orgId,
      extraction
    );

    // Create inbox items from action items / decisions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createInboxItems(supabase, orgId, contextItemId, extraction as any, item.source_type);

    return {
      contextItemId,
      status: "ready",
      extraction,
      linkedSessions,
    };
  } catch (err) {
    // Mark as error
    await supabase
      .from("context_items")
      .update({ status: "error" })
      .eq("id", contextItemId);

    const message = err instanceof Error ? err.message : "Processing failed";
    console.error(`Pipeline error for ${contextItemId}:`, message);

    return {
      contextItemId,
      status: "error",
      error: message,
    };
  }
}

/**
 * Step 1: Extract structured entities from raw content.
 */
async function extractContent(
  rawContent: string,
  title: string
): Promise<ExtractionResult> {
  const truncated = rawContent.slice(0, 12_000);

  const { object } = await generateObject({
    model: extractionModel,
    schema: ExtractionSchema,
    prompt: `You are extracting structured information from a document.

Filename/Title: ${title}

Document content:
${truncated}

Extract the title, summaries, entities, sentiment, and an executive summary. Be specific and factual.`,
  });

  return object;
}

/**
 * Step 3: Match content to active sessions and create links.
 */
async function linkToSessions(
  supabase: AnySupabase,
  contextItemId: string,
  orgId: string,
  extraction: ExtractionResult
): Promise<string[]> {
  // Fetch active sessions for the org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions } = await (supabase as any)
    .from("sessions")
    .select("id, name, goal")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (!sessions || sessions.length === 0) return [];

  // Ask AI to match content against sessions
  const sessionList = sessions
    .map((s: { id: string; name: string; goal: string }) => `- ${s.id}: "${s.name}" — ${s.goal}`)
    .join("\n");

  const { object } = await generateObject({
    model: extractionModel,
    schema: SessionMatchSchema,
    prompt: `You are matching a piece of content to active work sessions. Only match if the content is genuinely relevant (score >= 0.5).

Content title: ${extraction.title}
Content summary: ${extraction.summary}
Topics: ${extraction.entities.topics.join(", ")}
Projects: ${extraction.entities.projects.join(", ")}

Active sessions:
${sessionList}

Return matches only for sessions where this content would be useful. If none match, return an empty matches array.`,
  });

  // Filter to relevant matches and insert links
  const relevant = object.matches.filter((m) => m.relevanceScore >= 0.5);
  if (relevant.length === 0) return [];

  const validSessionIds = new Set(sessions.map((s: { id: string }) => s.id));
  const links = relevant
    .filter((m) => validSessionIds.has(m.sessionId))
    .map((m) => ({
      session_id: m.sessionId,
      context_item_id: contextItemId,
      relevance_score: m.relevanceScore,
      added_by: "system",
    }));

  if (links.length > 0) {
    // Check for existing links to avoid duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("session_context_links")
      .select("session_id")
      .eq("context_item_id", contextItemId)
      .in(
        "session_id",
        links.map((l) => l.session_id)
      );

    const existingIds = new Set(
      (existing ?? []).map((e: { session_id: string }) => e.session_id)
    );
    const newLinks = links.filter((l) => !existingIds.has(l.session_id));

    if (newLinks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("session_context_links").insert(newLinks);
    }
  }

  return links.map((l) => l.session_id);
}
