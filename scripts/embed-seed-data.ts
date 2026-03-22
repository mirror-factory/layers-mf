// Generate embeddings for seed context items so vector search works locally.
// Run with: npx tsx scripts/embed-seed-data.ts
// Requires: AI_GATEWAY_API_KEY in .env.local, Supabase running locally

import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";
import { gateway } from "@ai-sdk/gateway";

// Use local Supabase defaults if env vars not set
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(supabaseUrl, supabaseKey);

const embeddingModel = gateway.textEmbeddingModel(
  "openai/text-embedding-3-small"
);

async function main() {
  console.log("Connecting to Supabase at", supabaseUrl);

  // Fetch all context items without embeddings
  const { data: items, error } = await supabase
    .from("context_items")
    .select("id, title, description_long, raw_content")
    .is("embedding", null)
    .eq("status", "ready");

  if (error) {
    console.error("Failed to fetch context items:", error.message);
    process.exit(1);
  }

  if (!items?.length) {
    console.log("No items need embedding. All done.");
    return;
  }

  console.log(`Found ${items.length} items without embeddings.\n`);

  let success = 0;
  let failed = 0;

  for (const item of items) {
    const text = item.description_long || item.raw_content || item.title;
    try {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text.slice(0, 8000),
      });

      const { error: updateError } = await supabase
        .from("context_items")
        .update({ embedding: embedding as unknown as string })
        .eq("id", item.id);

      if (updateError) {
        console.error(`  x ${item.title}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`  + ${item.title}`);
        success++;
      }
    } catch (err) {
      console.error(
        `  x ${item.title}: ${err instanceof Error ? err.message : err}`
      );
      failed++;
    }
  }

  console.log(`\nDone. Embedded: ${success}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
