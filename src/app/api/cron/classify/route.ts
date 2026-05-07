import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { classifyContent } from "@/lib/ai/classify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find context items that need classification:
  // - status = 'processing' (recently ingested, awaiting AI pipeline)
  // - OR status = 'ready' but missing description_short (legacy items never classified)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items, error } = await (supabase as any)
    .from("context_items")
    .select("id, raw_content, content_type, title, org_id, status")
    .or("status.eq.processing,description_short.is.null")
    .not("raw_content", "is", null)
    .order("ingested_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[cron/classify] Failed to fetch items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }

  if (!items?.length) {
    return NextResponse.json({ processed: 0, message: "No items to classify" });
  }

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.raw_content) continue;

    try {
      const classification = await classifyContent(
        item.raw_content,
        item.content_type ?? "document",
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("context_items")
        .update({
          title: classification.title,
          description_short: classification.shortDesc,
          description_long: classification.longDesc,
          entities: {
            people: classification.entities.people,
            topics: classification.entities.topics,
            decisions: classification.entities.decisions,
            action_items: classification.entities.actionItems,
            tags: classification.tags,
            categories: classification.categories,
            language: classification.language,
            framework: classification.framework,
          },
          status: "ready",
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) {
        console.error(
          `[cron/classify] Failed to update item ${item.id}:`,
          updateError,
        );
        failed++;
        continue;
      }

      processed++;
    } catch (err) {
      console.error(`[cron/classify] Classification failed for ${item.id}:`, err);

      // Mark as error so we don't retry endlessly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("context_items")
        .update({ status: "error" })
        .eq("id", item.id);

      failed++;
    }
  }

  console.log(
    `[cron/classify] Processed ${processed}, failed ${failed}, total ${items.length}`,
  );

  return NextResponse.json({
    processed,
    failed,
    total: items.length,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
