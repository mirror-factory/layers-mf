import { inngest } from "@/lib/inngest/client";
import { generateObject } from "ai";
import { extractionModel } from "@/lib/ai/config";
import { generateEmbedding, generateEmbeddings } from "@/lib/ai/embed";
import { findCrossSourceConnections } from "@/lib/ai/cross-source";
import { chunkDocument } from "@/lib/pipeline/chunker";
import {
  ExtractionSchema,
  SessionMatchSchema,
} from "@/lib/pipeline/extraction-schema";
import { createAdminClient } from "@/lib/supabase/server";
import { createInboxItems } from "@/lib/inbox";

export const processContextFunction = inngest.createFunction(
  {
    id: "process-context-item",
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: "context/item.created" },
  async ({ event, step }) => {
    const { contextItemId, orgId } = event.data;
    const supabase = createAdminClient();

    // Step 1: Fetch and validate
    const item = await step.run("fetch-item", async () => {
      const { data, error } = await supabase
        .from("context_items")
        .select(
          "id, raw_content, title, source_type, content_hash, status"
        )
        .eq("id", contextItemId)
        .single();

      if (error || !data) throw new Error(`Item not found: ${contextItemId}`);

      await supabase
        .from("context_items")
        .update({ status: "processing" })
        .eq("id", contextItemId);

      return data;
    });

    // Step 2: Extract metadata with AI
    const extraction = await step.run("extract-metadata", async () => {
      const truncated = (item.raw_content ?? "").slice(0, 12_000);
      const { object } = await generateObject({
        model: extractionModel,
        schema: ExtractionSchema,
        prompt: `You are extracting structured information from a document.

Filename/Title: ${item.title}

Document content:
${truncated}

Extract the title, summaries, entities, sentiment, and an executive summary. Be specific and factual.`,
      });

      await supabase
        .from("context_items")
        .update({
          title: object.title,
          description_short: object.description_short,
          description_long: object.description_long,
          entities: object.entities,
        })
        .eq("id", contextItemId);

      return object;
    });

    // Step 3: Chunk document and insert into context_chunks
    const chunks = await step.run("chunk-document", async () => {
      const rawChunks = chunkDocument(
        item.raw_content ?? "",
        extraction.title
      );

      // Delete old chunks if reprocessing
      await supabase
        .from("context_chunks")
        .delete()
        .eq("context_item_id", contextItemId);

      // Insert chunks without embeddings
      const rows = rawChunks.map((c) => ({
        org_id: orgId,
        context_item_id: contextItemId,
        chunk_index: c.chunkIndex,
        content: c.content,
        parent_content: c.parentContent,
        metadata: c.metadata as Record<string, string | number>,
      }));

      const { data: inserted } = await supabase
        .from("context_chunks")
        .insert(rows)
        .select("id, content");

      return inserted ?? [];
    });

    // Step 4: Batch embed all chunks
    await step.run("embed-chunks", async () => {
      if (chunks.length === 0) return;

      const texts = chunks.map((c: { content: string }) => c.content);
      const embeddings = await generateEmbeddings(texts);

      // Update each chunk with its embedding
      for (let i = 0; i < chunks.length; i++) {
        await supabase
          .from("context_chunks")
          .update({ embedding: embeddings[i] as unknown as string })
          .eq("id", chunks[i].id);
      }
    });

    // Step 5: Also update the context_item embedding (backward compat)
    await step.run("embed-item", async () => {
      const embedding = await generateEmbedding(item.raw_content ?? "");

      await supabase
        .from("context_items")
        .update({
          embedding: embedding as unknown as string,
          status: "ready",
          processed_at: new Date().toISOString(),
        })
        .eq("id", contextItemId);
    });

    // Step 6: Create inbox items
    await step.run("create-inbox", async () => {
      await createInboxItems(
        supabase,
        orgId,
        contextItemId,
        extraction,
        item.source_type
      );
    });

    // Step 7: Auto-link to active sessions
    const linkedSessions = await step.run("link-sessions", async () => {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, name, goal")
        .eq("org_id", orgId)
        .eq("status", "active");

      if (!sessions || sessions.length === 0) return [];

      const sessionList = sessions
        .map(
          (s: { id: string; name: string; goal: string }) =>
            `- ${s.id}: "${s.name}" — ${s.goal}`
        )
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

      const relevant = object.matches.filter((m) => m.relevanceScore >= 0.5);
      if (relevant.length === 0) return [];

      const validSessionIds = new Set(
        sessions.map((s: { id: string }) => s.id)
      );
      const links = relevant
        .filter((m) => validSessionIds.has(m.sessionId))
        .map((m) => ({
          session_id: m.sessionId,
          context_item_id: contextItemId,
          relevance_score: m.relevanceScore,
          added_by: "system",
        }));

      if (links.length > 0) {
        const { data: existing } = await supabase
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
          await supabase.from("session_context_links").insert(newLinks);
        }
      }

      return links.map((l) => l.session_id);
    });

    // Step 8: Find cross-source connections
    const connections = await step.run("find-connections", async () => {
      return findCrossSourceConnections(contextItemId, orgId, {
        maxCandidates: 5,
        supabase,
      });
    });

    // Create session insights for any significant connections
    if (connections.length > 0) {
      await step.run("create-connection-insights", async () => {
        // Collect all related item IDs from connections
        const relatedItemIds = [
          ...new Set(connections.map((c) => c.item_b_id)),
        ];

        // Find sessions that contain the new item or any related items
        const allItemIds = [contextItemId, ...relatedItemIds];
        const { data: sessionLinks } = await supabase
          .from("session_context_links")
          .select("session_id, context_item_id")
          .in("context_item_id", allItemIds);

        if (!sessionLinks || sessionLinks.length === 0) return;

        // Get unique session IDs
        const sessionIds = [
          ...new Set(sessionLinks.map((l: { session_id: string }) => l.session_id)),
        ];

        // Create an insight per session for the most significant connections
        const insightRows = sessionIds.map((sessionId: string) => {
          const criticalConnections = connections.filter(
            (c) => c.severity === "critical"
          );
          const importantConnections = connections.filter(
            (c) => c.severity === "important"
          );
          const topConnections =
            criticalConnections.length > 0
              ? criticalConnections
              : importantConnections.length > 0
                ? importantConnections
                : connections;

          const severity =
            criticalConnections.length > 0
              ? "critical"
              : importantConnections.length > 0
                ? "important"
                : "info";

          const descriptions = topConnections
            .map((c) => `[${c.type}] ${c.description}`)
            .join("; ");

          return {
            org_id: orgId,
            session_id: sessionId,
            insight_type: "cross_source_connection",
            title: `Cross-source connection found (${topConnections.length} link${topConnections.length > 1 ? "s" : ""})`,
            description: descriptions,
            severity,
            source_item_ids: [contextItemId],
            related_item_ids: relatedItemIds,
            status: "active",
            metadata: { connections },
          };
        });

        if (insightRows.length > 0) {
          await (supabase as any).from("session_insights").insert(insightRows);
        }
      });
    }

    return {
      contextItemId,
      status: "ready",
      chunkCount: chunks.length,
      linkedSessions,
      connectionCount: connections.length,
    };
  }
);
