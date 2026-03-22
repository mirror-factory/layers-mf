import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Session Agent — polls active sessions for new content and generates insights.
 * Runs every 15 minutes via Inngest cron.
 */
export const sessionAgentFunction = inngest.createFunction(
  { id: "session-agent-poll", name: "Session Agent Poll" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const supabase = createAdminClient();

    // Step 1: Find active sessions
    const sessions = await step.run("find-active-sessions", async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, org_id, name, updated_at")
        .eq("status", "active");
      return data ?? [];
    });

    if (sessions.length === 0) return { processed: 0 };

    let insightsCreated = 0;

    for (const session of sessions) {
      // Step 2: Check for new content linked since last agent run
      const newLinks = await step.run(
        `check-new-content-${session.id}`,
        async () => {
          const { data } = await supabase
            .from("session_context_links")
            .select("context_item_id, created_at")
            .eq("session_id", session.id)
            .gte(
              "created_at",
              new Date(Date.now() - 15 * 60 * 1000).toISOString()
            )
            .order("created_at", { ascending: false });
          return data ?? [];
        }
      );

      if (newLinks.length === 0) continue;

      // Step 3: Generate a summary delta for the session
      await step.run(`generate-insight-${session.id}`, async () => {
        // Fetch the new items' details
        const itemIds = newLinks.map((l) => l.context_item_id);
        const { data: items } = await supabase
          .from("context_items")
          .select("id, title, source_type, description_short")
          .in("id", itemIds);

        if (!items || items.length === 0) return;

        const summary = items
          .map((i) => `- ${i.title} (${i.source_type})`)
          .join("\n");

        // Create a "summary_delta" insight
        await (supabase as any).from("session_insights").insert({
          org_id: session.org_id,
          session_id: session.id,
          insight_type: "summary_delta",
          title: `${items.length} new item${items.length === 1 ? "" : "s"} since last check`,
          description: `New content linked to "${session.name}":\n${summary}`,
          severity: items.length >= 3 ? "important" : "info",
          source_item_ids: itemIds,
          status: "active",
        });

        insightsCreated++;
      });
    }

    return { sessionsChecked: sessions.length, insightsCreated };
  }
);
