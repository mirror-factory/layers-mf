import { NextRequest } from "next/server";
import { generateText } from "ai";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/discord/api";
import { generateDigestForUser } from "@/lib/email/digest";
import { renderDigestHTML } from "@/lib/email/digest-template";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/digest
 * Morning digest cron — 7 AM UTC, weekdays only.
 * Generates personalized digests per partner and posts to Discord #granger-digest.
 * Also stores digest as a searchable context item (compound loop).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const digestChannelId = process.env.DISCORD_DIGEST_CHANNEL_ID;

  // Fetch users with digest_enabled = true
  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id, org_id")
    .eq("digest_enabled", true);

  if (prefsError) {
    return Response.json({ error: prefsError.message }, { status: 500 });
  }

  if (!prefs || prefs.length === 0) {
    return Response.json({ processed: 0, sent: 0, skipped: 0 });
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const discordDigests: string[] = [];

  for (const { user_id, org_id } of prefs) {
    try {
      processed++;
      const data = await generateDigestForUser(supabase, user_id, org_id);

      if (!data) {
        skipped++;
        continue;
      }

      // Compound loop: store digest as a searchable context item
      if (data.items.length > 0) {
        const digestContent = data.items
          .map((i) => `[${i.priority}] ${i.title}: ${i.type}`)
          .join("\n");

        await supabase.from("context_items").insert({
          org_id: org_id,
          source_type: "layers-ai",
          source_id: `digest-${user_id}-${new Date().toISOString().split("T")[0]}`,
          title: `Daily Digest — ${data.date}`,
          raw_content: digestContent,
          content_type: "document",
          status: "ready",
          ingested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        });
      }

      // Generate AI-personalized Discord digest if channel is configured
      if (digestChannelId) {
        const discordDigest = await generateDiscordDigest(data, user_id);
        if (discordDigest) {
          discordDigests.push(discordDigest);
        }
      }

      // TODO: Send email via Resend when configured
      // For now, render HTML for the response
      renderDigestHTML(data);
      sent++;

      console.log(
        `[digest] Generated for user ${user_id}: ${data.items.length} items, ${data.overdueActions.length} overdue`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user_id}: ${msg}`);
    }
  }

  // Post combined digest to Discord
  if (digestChannelId && discordDigests.length > 0) {
    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const fullDigest = `**Granger Daily Digest** — ${dateStr}\n\n${discordDigests.join("\n\n---\n\n")}`;

    await sendDiscordChunked(digestChannelId, fullDigest);
  }

  return Response.json({
    processed,
    sent,
    skipped,
    discord: discordDigests.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * Generate an AI-personalized Discord digest for a single partner.
 */
async function generateDiscordDigest(
  data: Awaited<ReturnType<typeof generateDigestForUser>> & {},
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Look up Discord user ID for @mention
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const displayName = profile?.full_name ?? "Partner";

  // Build context for AI
  const urgentItems = [
    ...data.overdueActions.map(
      (a) => `- **OVERDUE**: ${a.title} (${a.source})`
    ),
    ...data.items
      .filter((i) => i.priority === "urgent" || i.priority === "high")
      .map((i) => `- [${i.priority}] ${i.type}: ${i.title}`),
  ];

  const normalItems = data.items
    .filter((i) => i.priority !== "urgent" && i.priority !== "high")
    .map((i) => `- ${i.type}: ${i.title}`)
    .slice(0, 10);

  const { text: digestText } = await generateText({
    model: gateway(TASK_MODELS.digest),
    prompt: `Generate a concise morning digest for ${displayName}. Be direct, no filler.

**Overdue / Urgent (${urgentItems.length}):**
${urgentItems.join("\n") || "None"}

**Recent Activity (${normalItems.length} of ${data.items.length}):**
${normalItems.join("\n") || "None"}

**New Context (last 24h): ${data.newContextCount} items**

Format as a Discord message with markdown. Start with "Good morning ${displayName}." Be under 800 characters. Highlight urgent items first. End with a suggested priority action for today.`,
  });

  return `**${displayName}**\n${digestText}`;
}

/**
 * Send a message to Discord, splitting into chunks if it exceeds the 2000 char limit.
 */
async function sendDiscordChunked(channelId: string, content: string) {
  let remaining = content;
  while (remaining.length > 0) {
    if (remaining.length <= 2000) {
      await sendMessage(channelId, remaining);
      break;
    }
    // Find a good split point (paragraph break within limit)
    let splitAt = remaining.lastIndexOf("\n\n", 2000);
    if (splitAt < 500) splitAt = 2000;
    await sendMessage(channelId, remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
}
