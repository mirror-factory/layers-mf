# Scale Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scale Layers from 93 docs to 100k+ docs with parent-child chunking, durable processing via Inngest, upsert/dedup, partitioned vector indexes, and a public API/MCP server.

**Architecture:** Replace fire-and-forget processing with Inngest durable step functions. Split documents into ~400-token child chunks with ~1500-token parent windows. Search against chunks with RRF, dedup by document. Partition vector indexes by org_id. Expose search via REST API + MCP server with API key auth.

**Tech Stack:** Inngest (job queue), pgvector (embeddings), Supabase (database), Next.js App Router, Vercel AI SDK, OpenAI text-embedding-3-small

**Linear Issue:** PROD-171
**Design Doc:** `docs/plans/2026-03-12-scale-chunking-api-design.md`

---

## Phase 1: Inngest Setup + Upsert/Dedup (1 day)

### Task 1.1: Install Inngest and Create Client

**Files:**
- Create: `src/lib/inngest/client.ts`
- Modify: `package.json`

**Step 1: Install Inngest**

```bash
pnpm add inngest
```

**Step 2: Create Inngest client**

```typescript
// src/lib/inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "layers",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

**Step 3: Commit**

```bash
git add src/lib/inngest/client.ts package.json pnpm-lock.yaml
git commit -m "feat: add Inngest client for durable processing"
```

### Task 1.2: Create Inngest Serve Route

**Files:**
- Create: `src/app/api/inngest/route.ts`

**Step 1: Create the route handler**

```typescript
// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processContextFunction } from "@/lib/inngest/functions/process-context";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processContextFunction],
});
```

**Step 2: Create a placeholder function to verify setup**

```typescript
// src/lib/inngest/functions/process-context.ts
import { inngest } from "@/lib/inngest/client";

export const processContextFunction = inngest.createFunction(
  {
    id: "process-context-item",
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: "context/item.created" },
  async ({ event, step }) => {
    // Placeholder — will be filled in Phase 2
    const { contextItemId, orgId } = event.data;
    return { contextItemId, status: "placeholder" };
  }
);
```

**Step 3: Verify dev server starts**

```bash
pnpm dev
# In another terminal:
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

**Step 4: Commit**

```bash
git add src/app/api/inngest/route.ts src/lib/inngest/functions/process-context.ts
git commit -m "feat: add Inngest serve route and placeholder function"
```

### Task 1.3: Add content_hash and Unique Constraint Migration

**Files:**
- Create: `supabase/migrations/20260312000000_upsert_dedup.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260312000000_upsert_dedup.sql

-- Add content hash for change detection (skip reprocessing if unchanged)
ALTER TABLE context_items
  ADD COLUMN IF NOT EXISTS content_hash text;

-- Unique constraint for upsert/dedup on source items
-- source_id can be null for uploads, so use partial index
CREATE UNIQUE INDEX IF NOT EXISTS uq_context_items_source
  ON context_items (org_id, source_type, source_id)
  WHERE source_id IS NOT NULL;
```

**Step 2: Apply migration**

Use the Supabase MCP `apply_migration` tool with project_id `fenhyfxbapybmddvhcei`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260312000000_upsert_dedup.sql
git commit -m "feat: add content_hash column and source dedup index"
```

### Task 1.4: Update Webhook Handlers to Emit Inngest Events

**Files:**
- Modify: `src/app/api/ingest/upload/route.ts`
- Modify: `src/app/api/webhooks/ingest/route.ts`

**Step 1: Replace direct `processContextItem()` calls with Inngest event emission**

In both files, find the call to `processContextItem(supabase, id, orgId)` and replace with:

```typescript
import { inngest } from "@/lib/inngest/client";

// Replace:
// processContextItem(supabase, id, orgId).catch(console.error);

// With:
await inngest.send({
  name: "context/item.created",
  data: { contextItemId: id, orgId },
});
```

**Step 2: Add content_hash computation on insert**

Before inserting a context_item, compute the hash:

```typescript
import { createHash } from "crypto";

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
```

Add `content_hash: contentHash(rawContent)` to the insert payload.

For webhook upserts (items with source_id), use Supabase upsert:

```typescript
const { data: item } = await supabase
  .from("context_items")
  .upsert(
    {
      org_id: orgId,
      source_type: sourceType,
      source_id: sourceId,
      title,
      raw_content: rawContent,
      content_hash: contentHash(rawContent),
      content_type: contentType,
      source_metadata: metadata,
      status: "pending",
    },
    { onConflict: "org_id,source_type,source_id", ignoreDuplicates: false }
  )
  .select("id, content_hash")
  .single();

// Only process if content actually changed
if (item) {
  await inngest.send({
    name: "context/item.created",
    data: { contextItemId: item.id, orgId },
  });
}
```

**Step 3: Test upload flow**

Upload a test file via the UI. Verify:
1. context_item is created with content_hash
2. Inngest event is emitted (check Inngest dev server dashboard)
3. Placeholder function runs

**Step 4: Commit**

```bash
git add src/app/api/ingest/upload/route.ts src/app/api/webhooks/ingest/route.ts
git commit -m "feat: emit Inngest events instead of fire-and-forget processing"
```

---

## Phase 2: Chunking Pipeline + context_chunks Table (2 days)

### Task 2.1: Create context_chunks Table Migration

**Files:**
- Create: `supabase/migrations/20260312010000_context_chunks.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260312010000_context_chunks.sql

CREATE TABLE context_chunks (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  context_item_id uuid NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  parent_content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX idx_chunks_context_item ON context_chunks (context_item_id);
CREATE INDEX idx_chunks_org_status ON context_chunks (org_id);
CREATE INDEX idx_chunks_embedding ON context_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_search_tsv ON context_chunks USING gin (search_tsv);

-- RLS
ALTER TABLE context_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org chunks" ON context_chunks
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Commit**

```bash
git add supabase/migrations/20260312010000_context_chunks.sql
git commit -m "feat: add context_chunks table for parent-child chunking"
```

### Task 2.2: Build Chunking Utility

**Files:**
- Create: `src/lib/pipeline/chunker.ts`
- Create: `src/lib/pipeline/__tests__/chunker.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pipeline/__tests__/chunker.test.ts
import { describe, it, expect } from "vitest";
import { chunkDocument } from "../chunker";

describe("chunkDocument", () => {
  it("returns single chunk for short content", () => {
    const chunks = chunkDocument("Short content here.", "Test Doc");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Short content here.");
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("splits long content into multiple chunks", () => {
    // ~2000 chars = should produce 2+ chunks at 1600 char target
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("parent_content is larger than content", () => {
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    for (const chunk of chunks) {
      expect(chunk.parentContent.length).toBeGreaterThanOrEqual(chunk.content.length);
    }
  });

  it("chunks have sequential indexes", () => {
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it("includes document title in parent_content", () => {
    const chunks = chunkDocument("Some content about marketing.", "Marketing Report Q1");
    expect(chunks[0].parentContent).toContain("Marketing Report Q1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/pipeline/__tests__/chunker.test.ts
```

**Step 3: Write the chunker implementation**

```typescript
// src/lib/pipeline/chunker.ts

export interface Chunk {
  chunkIndex: number;
  content: string;
  parentContent: string;
  metadata: Record<string, unknown>;
}

const CHILD_SIZE = 1600;   // ~400 tokens
const PARENT_SIZE = 6000;  // ~1500 tokens
const OVERLAP = 200;       // ~50 tokens overlap between children

/**
 * Split a document into parent-child chunks.
 * Child chunks (~400 tokens) are used for vector search.
 * Parent chunks (~1500 tokens) are returned to the LLM as context.
 */
export function chunkDocument(rawContent: string, title: string): Chunk[] {
  if (rawContent.length <= CHILD_SIZE) {
    return [{
      chunkIndex: 0,
      content: rawContent,
      parentContent: `[Document: ${title}]\n\n${rawContent}`,
      metadata: { title },
    }];
  }

  const chunks: Chunk[] = [];
  let offset = 0;
  let index = 0;

  while (offset < rawContent.length) {
    // Find child boundary (try to break at sentence/paragraph)
    let end = Math.min(offset + CHILD_SIZE, rawContent.length);
    if (end < rawContent.length) {
      const breakPoint = findBreakPoint(rawContent, offset + CHILD_SIZE - 200, end + 100);
      if (breakPoint > offset) end = breakPoint;
    }

    const content = rawContent.slice(offset, end).trim();
    if (content.length === 0) break;

    // Parent window: expand around the child chunk
    const parentStart = Math.max(0, offset - (PARENT_SIZE - CHILD_SIZE) / 2);
    const parentEnd = Math.min(rawContent.length, parentStart + PARENT_SIZE);
    const parentContent = `[Document: ${title}]\n\n${rawContent.slice(parentStart, parentEnd).trim()}`;

    chunks.push({
      chunkIndex: index,
      content,
      parentContent,
      metadata: { title, charOffset: offset },
    });

    offset = end - OVERLAP;
    if (offset >= rawContent.length) break;
    index++;
  }

  return chunks;
}

function findBreakPoint(text: string, start: number, end: number): number {
  // Prefer paragraph breaks, then sentence breaks, then word breaks
  const region = text.slice(start, end);

  const paraBreak = region.lastIndexOf("\n\n");
  if (paraBreak > 0) return start + paraBreak + 2;

  const sentenceBreak = region.lastIndexOf(". ");
  if (sentenceBreak > 0) return start + sentenceBreak + 2;

  const wordBreak = region.lastIndexOf(" ");
  if (wordBreak > 0) return start + wordBreak + 1;

  return end;
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/pipeline/__tests__/chunker.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/pipeline/chunker.ts src/lib/pipeline/__tests__/chunker.test.ts
git commit -m "feat: add parent-child document chunker with tests"
```

### Task 2.3: Implement Full Inngest Pipeline Function

**Files:**
- Modify: `src/lib/inngest/functions/process-context.ts`
- Modify: `src/lib/ai/embed.ts`

**Step 1: Add batch embedding function**

```typescript
// Add to src/lib/ai/embed.ts
import { embedMany } from "ai";

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // Process in batches of 100 to stay within API limits
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch.map((t) => t.slice(0, 8000)),
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
```

**Step 2: Implement the full pipeline function**

```typescript
// src/lib/inngest/functions/process-context.ts
import { inngest } from "@/lib/inngest/client";
import { generateObject } from "ai";
import { extractionModel } from "@/lib/ai/config";
import { generateEmbeddings } from "@/lib/ai/embed";
import { chunkDocument } from "@/lib/pipeline/chunker";
import { ExtractionSchema } from "@/lib/pipeline/extraction-schema";
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
        .select("id, raw_content, title, source_type, content_hash, status")
        .eq("id", contextItemId)
        .single();

      if (error || !data) throw new Error(`Item not found: ${contextItemId}`);

      await supabase
        .from("context_items")
        .update({ status: "processing" })
        .eq("id", contextItemId);

      return data;
    });

    // Step 2: Extract metadata
    const extraction = await step.run("extract-metadata", async () => {
      const truncated = item.raw_content.slice(0, 12_000);
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

    // Step 3: Chunk document
    const chunks = await step.run("chunk-document", async () => {
      const rawChunks = chunkDocument(item.raw_content, extraction.title);

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
        metadata: c.metadata,
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
      const { generateEmbedding } = await import("@/lib/ai/embed");
      const embedding = await generateEmbedding(item.raw_content);

      await supabase
        .from("context_items")
        .update({
          embedding: embedding as unknown as string,
          status: "ready",
          processed_at: new Date().toISOString(),
        })
        .eq("id", contextItemId);
    });

    // Step 6: Link to sessions + create inbox items
    await step.run("link-and-inbox", async () => {
      // Import the existing linkToSessions logic
      const { processContextItem } = await import("@/lib/pipeline/process-context");
      // We already extracted and embedded — just call the linking part
      await createInboxItems(supabase, orgId, contextItemId, extraction, item.source_type);
    });

    return { contextItemId, status: "ready", chunkCount: chunks.length };
  }
);
```

**Step 3: Add INNGEST_EVENT_KEY to .env.local**

```bash
# Add to .env.local
INNGEST_EVENT_KEY=local-dev-key
INNGEST_SIGNING_KEY=  # Leave empty for local dev
```

**Step 4: Build and verify no type errors**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add src/lib/inngest/functions/process-context.ts src/lib/ai/embed.ts
git commit -m "feat: implement durable Inngest pipeline with chunking + batch embed"
```

---

## Phase 3: New Hybrid Search on Chunks (1 day)

### Task 3.1: Create hybrid_search_chunks SQL Function

**Files:**
- Create: `supabase/migrations/20260312020000_hybrid_search_chunks.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260312020000_hybrid_search_chunks.sql

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  p_org_id          uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_limit           int DEFAULT 10,
  p_source_type     text DEFAULT NULL,
  p_content_type    text DEFAULT NULL,
  p_date_from       timestamptz DEFAULT NULL,
  p_date_to         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  context_item_id   uuid,
  title             text,
  description_short text,
  parent_content    text,
  source_type       text,
  content_type      text,
  source_url        text,
  source_created_at timestamptz,
  rrf_score         float
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH semantic AS (
    SELECT
      cc.id,
      cc.context_item_id,
      ROW_NUMBER() OVER (ORDER BY cc.embedding <=> p_query_embedding) AS rank
    FROM context_chunks cc
    JOIN context_items ci ON ci.id = cc.context_item_id
    WHERE cc.org_id = p_org_id
      AND ci.status = 'ready'
      AND cc.embedding IS NOT NULL
      AND (p_source_type IS NULL OR ci.source_type = p_source_type)
      AND (p_content_type IS NULL OR ci.content_type = p_content_type)
      AND (p_date_from IS NULL OR ci.source_created_at >= p_date_from)
      AND (p_date_to IS NULL OR ci.source_created_at <= p_date_to)
    ORDER BY cc.embedding <=> p_query_embedding
    LIMIT p_limit * 3
  ),
  fulltext AS (
    SELECT
      cc.id,
      cc.context_item_id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(cc.search_tsv, plainto_tsquery('english', p_query_text)) DESC
      ) AS rank
    FROM context_chunks cc
    JOIN context_items ci ON ci.id = cc.context_item_id
    WHERE cc.org_id = p_org_id
      AND ci.status = 'ready'
      AND cc.search_tsv @@ plainto_tsquery('english', p_query_text)
      AND (p_source_type IS NULL OR ci.source_type = p_source_type)
      AND (p_content_type IS NULL OR ci.content_type = p_content_type)
      AND (p_date_from IS NULL OR ci.source_created_at >= p_date_from)
      AND (p_date_to IS NULL OR ci.source_created_at <= p_date_to)
    LIMIT p_limit * 3
  ),
  rrf AS (
    SELECT
      COALESCE(s.id, f.id) AS id,
      COALESCE(s.context_item_id, f.context_item_id) AS context_item_id,
      COALESCE(1.0 / (60.0 + s.rank), 0.0) +
      COALESCE(1.0 / (60.0 + f.rank), 0.0) AS score
    FROM semantic s
    FULL OUTER JOIN fulltext f ON s.id = f.id
  ),
  -- Dedup: max 2 chunks per document, take highest scoring
  ranked AS (
    SELECT
      r.*,
      ROW_NUMBER() OVER (PARTITION BY r.context_item_id ORDER BY r.score DESC) AS doc_rank
    FROM rrf r
  )
  SELECT
    rk.id,
    rk.context_item_id,
    ci.title,
    ci.description_short,
    cc.parent_content,
    ci.source_type,
    ci.content_type,
    ci.source_metadata->>'url' AS source_url,
    ci.source_created_at,
    rk.score AS rrf_score
  FROM ranked rk
  JOIN context_items ci ON ci.id = rk.context_item_id
  JOIN context_chunks cc ON cc.id = rk.id
  WHERE rk.doc_rank <= 2
  ORDER BY rk.score DESC
  LIMIT p_limit;
$$;
```

**Step 2: Apply migration**

**Step 3: Commit**

```bash
git add supabase/migrations/20260312020000_hybrid_search_chunks.sql
git commit -m "feat: add hybrid_search_chunks function with RRF + doc dedup"
```

### Task 3.2: Update Search Library to Use Chunks

**Files:**
- Modify: `src/lib/db/search.ts`

**Step 1: Add chunk-based search alongside existing search**

Add a new function `searchContextChunks` that calls `hybrid_search_chunks`. Keep the existing `searchContext` function as fallback.

```typescript
export type ChunkSearchResult = {
  id: string;
  context_item_id: string;
  title: string;
  description_short: string | null;
  parent_content: string;
  source_type: string;
  content_type: string;
  source_url: string | null;
  source_created_at: string | null;
  rrf_score: number;
};

export async function searchContextChunks(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit = 10,
  filters?: SearchFilters
): Promise<ChunkSearchResult[]> {
  const db = supabase as AnySupabase;
  const embedding = await generateEmbedding(query);

  const { data, error } = await db.rpc("hybrid_search_chunks", {
    p_org_id: orgId,
    p_query_text: query,
    p_query_embedding: embedding,
    p_limit: limit,
    p_source_type: filters?.sourceType ?? null,
    p_content_type: filters?.contentType ?? null,
    p_date_from: filters?.dateFrom ?? null,
    p_date_to: filters?.dateTo ?? null,
  });

  if (error) {
    // Fallback to old search if chunks table is empty
    console.warn("Chunk search failed, falling back:", error.message);
    const oldResults = await searchContext(supabase, orgId, query, limit, filters);
    return oldResults.map((r) => ({
      ...r,
      context_item_id: r.id,
      parent_content: r.description_long ?? r.description_short ?? "",
    }));
  }

  return (data ?? []) as ChunkSearchResult[];
}

export function buildChunkContextBlock(results: ChunkSearchResult[]): string {
  if (results.length === 0) return "No relevant context found.";
  return results
    .map((r, i) =>
      [
        `[${i + 1}] ${r.title} (${r.source_type} · ${r.content_type})`,
        r.parent_content,
      ].join("\n")
    )
    .join("\n\n---\n\n");
}
```

**Step 2: Update chat tools to prefer chunk search**

In `src/lib/ai/tools.ts`, update the `search_context` tool to use `searchContextChunks` and `buildChunkContextBlock`.

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/lib/db/search.ts src/lib/ai/tools.ts
git commit -m "feat: add chunk-based hybrid search with fallback to legacy"
```

---

## Phase 4: Backfill Existing Documents (half day)

### Task 4.1: Create Backfill Script

**Files:**
- Create: `scripts/backfill-chunks.ts`

**Step 1: Write the backfill script**

```typescript
// scripts/backfill-chunks.ts
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
  // Fetch all ready items that don't have chunks yet
  const { data: items, error } = await supabase
    .from("context_items")
    .select("id, org_id")
    .eq("status", "ready")
    .order("ingested_at", { ascending: true });

  if (error) throw error;
  console.log(`Found ${items?.length ?? 0} items to backfill`);

  for (const item of items ?? []) {
    // Check if already has chunks
    const { count } = await supabase
      .from("context_chunks")
      .select("id", { count: "exact", head: true })
      .eq("context_item_id", item.id);

    if ((count ?? 0) > 0) {
      console.log(`Skipping ${item.id} — already has chunks`);
      continue;
    }

    console.log(`Sending ${item.id} for reprocessing...`);
    await inngest.send({
      name: "context/item.created",
      data: { contextItemId: item.id, orgId: item.org_id },
    });

    // Small delay to avoid overwhelming the pipeline
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Backfill events sent. Monitor progress in Inngest dashboard.");
}

backfill().catch(console.error);
```

**Step 2: Run the backfill**

```bash
npx tsx scripts/backfill-chunks.ts
```

**Step 3: Verify chunks were created**

Check in Supabase: `SELECT count(*) FROM context_chunks;` should be > 0.

**Step 4: Test search quality**

Search for "marketing strategy" via the UI chat. Verify results reference parent_content from chunks.

**Step 5: Commit**

```bash
git add scripts/backfill-chunks.ts
git commit -m "feat: add backfill script for existing documents to chunks"
```

---

## Phase 5: Partition by org_id (1 day)

> **NOTE:** Partitioning is a production optimization. Skip this phase during initial development and revisit when you have 5+ orgs or 10k+ chunks. The current single-table with indexes will work fine until then.

### Task 5.1: Plan Partition Migration

This requires careful migration since you can't partition an existing table in-place. The approach:

1. Create new partitioned table `context_chunks_partitioned`
2. Copy data from `context_chunks`
3. Swap tables (rename)
4. Create partitions for existing orgs
5. Create auto-partition function triggered on new org creation

**This task should be done when approaching scale.** For now, the HNSW + GIN indexes on the single `context_chunks` table will handle 10k+ chunks fine.

---

## Phase 6: API/MCP Server + api_keys (2 days)

### Task 6.1: Create api_keys Table Migration

**Files:**
- Create: `supabase/migrations/20260312030000_api_keys.sql`

```sql
-- supabase/migrations/20260312030000_api_keys.sql

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL,
  scopes text[] DEFAULT '{read}',
  rate_limit int DEFAULT 100,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_user ON api_keys (user_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own API keys" ON api_keys
  FOR ALL USING (user_id = auth.uid());
```

**Apply migration, then commit.**

### Task 6.2: API Key Management Routes

**Files:**
- Create: `src/app/api/v1/keys/route.ts`
- Create: `src/lib/api-auth.ts`

**Step 1: Create API key auth utility**

```typescript
// src/lib/api-auth.ts
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `lyr_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export async function validateApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer lyr_")) return null;

  const key = authHeader.slice(7);
  const hash = createHash("sha256").update(key).digest("hex");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id, org_id, scopes, rate_limit, expires_at")
    .eq("key_hash", hash)
    .single();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}
```

**Step 2: Create key management route**

```typescript
// src/app/api/v1/keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, scopes, rate_limit, last_used_at, created_at, expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(keys ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return new Response("No org", { status: 400 });

  const body = await request.json();
  const { key, hash, prefix } = generateApiKey();

  await supabase.from("api_keys").insert({
    user_id: user.id,
    org_id: member.org_id,
    key_hash: hash,
    key_prefix: prefix,
    name: body.name || "API Key",
    scopes: body.scopes || ["read"],
  });

  // Return the full key ONCE — it can never be retrieved again
  return NextResponse.json({ key, prefix, name: body.name || "API Key" });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await request.json();
  await supabase.from("api_keys").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
```

**Commit after implementing.**

### Task 6.3: Public Search API

**Files:**
- Create: `src/app/api/v1/search/route.ts`
- Create: `src/app/api/v1/context/route.ts`
- Create: `src/app/api/v1/context/[id]/route.ts`

**Step 1: Search endpoint**

```typescript
// src/app/api/v1/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { searchContextChunks } from "@/lib/db/search";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const apiKey = await validateApiKey(request.headers.get("authorization"));
  if (!apiKey) return new Response("Invalid API key", { status: 401 });

  const body = await request.json();
  if (!body.query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const supabase = createAdminClient();
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

  const results = await searchContextChunks(
    supabase as any,
    apiKey.org_id,
    body.query,
    limit,
    body.filters
  );

  return NextResponse.json({ results });
}
```

**Step 2: Context list and detail endpoints**

Similar pattern — validate API key, query with org_id scope, return JSON.

**Step 3: Commit**

```bash
git add src/app/api/v1/
git commit -m "feat: add public REST API with API key auth"
```

### Task 6.4: MCP Server (HTTP SSE)

**Files:**
- Create: `src/app/api/mcp/route.ts`

> **Reference:** Use the MCP SDK (`@modelcontextprotocol/sdk`) to create a Streamable HTTP transport server. The server exposes tools (search_context, list_documents, get_document) authenticated via API key in the Authorization header.

This is the most complex task. Use the MCP SDK docs at `docs/` or via context7 for the latest Streamable HTTP server pattern.

**Key tools to expose:**

```typescript
server.tool("search_context", {
  description: "Search across all documents in your Layers context library",
  inputSchema: z.object({
    query: z.string().describe("Natural language search query"),
    limit: z.number().optional().describe("Max results (1-50, default 10)"),
  }),
  handler: async ({ query, limit }) => {
    // Use searchContextChunks with the API key's org_id
  },
});

server.tool("list_documents", {
  description: "List documents in your context library",
  inputSchema: z.object({
    limit: z.number().optional(),
    sourceType: z.string().optional(),
  }),
  handler: async ({ limit, sourceType }) => {
    // Query context_items with filters
  },
});

server.tool("get_document", {
  description: "Get full content of a specific document",
  inputSchema: z.object({
    id: z.string().describe("Document ID"),
  }),
  handler: async ({ id }) => {
    // Fetch context_item by id within org scope
  },
});
```

**Commit after implementing.**

### Task 6.5: Settings UI for API Keys

**Files:**
- Create: `src/app/(dashboard)/settings/api-keys/page.tsx`
- Create: `src/components/api-key-manager.tsx`

Build a settings page that:
1. Lists existing keys (prefix, name, last used, created)
2. "Create Key" button → shows the full key ONCE with copy button
3. Delete button per key
4. Shows MCP connection instructions

**Commit after implementing.**

---

## Phase 7: Daily Reconciliation Cron (1 day)

### Task 7.1: Create Reconciliation Inngest Function

**Files:**
- Create: `src/lib/inngest/functions/reconcile.ts`
- Modify: `src/app/api/inngest/route.ts` (add to functions array)

**Step 1: Write the cron function**

```typescript
// src/lib/inngest/functions/reconcile.ts
import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/server";

export const dailyReconciliation = inngest.createFunction(
  { id: "daily-reconciliation" },
  { cron: "0 3 * * *" }, // 3 AM daily
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all orgs with active integrations
    const orgs = await step.run("fetch-orgs", async () => {
      const { data } = await supabase
        .from("integrations")
        .select("org_id, provider, sync_config")
        .eq("status", "active");
      return data ?? [];
    });

    // For each integration, trigger a full sync
    for (const integration of orgs) {
      await step.run(`reconcile-${integration.org_id}-${integration.provider}`, async () => {
        // Emit per-integration sync event
        await inngest.send({
          name: "integration/reconcile",
          data: {
            orgId: integration.org_id,
            provider: integration.provider,
            syncConfig: integration.sync_config,
          },
        });
      });
    }

    return { reconciledCount: orgs.length };
  }
);
```

**Step 2: Register in serve route**

Add `dailyReconciliation` to the functions array in `src/app/api/inngest/route.ts`.

**Step 3: Commit**

```bash
git add src/lib/inngest/functions/reconcile.ts src/app/api/inngest/route.ts
git commit -m "feat: add daily reconciliation cron for integration sync"
```

---

## Testing Checklist

After all phases, verify:

- [ ] Upload a file → appears in context library with chunks
- [ ] Search returns results from chunks (parent_content visible)
- [ ] Re-upload same file → upsert (no duplicate), skip if unchanged
- [ ] Webhook from Linear → creates/updates context_item + chunks
- [ ] Create API key in settings → test with curl
- [ ] `curl -H "Authorization: Bearer lyr_..." -d '{"query":"marketing"}' /api/v1/search`
- [ ] MCP server responds to tool calls
- [ ] Inngest dashboard shows function runs with step-by-step visibility
- [ ] Daily reconciliation cron fires (test manually)
- [ ] Old search still works as fallback (backward compat)

---

## Environment Variables to Add

```bash
# Inngest
INNGEST_EVENT_KEY=          # From inngest.com dashboard
INNGEST_SIGNING_KEY=        # From inngest.com dashboard (prod only)
```

No other new env vars needed — everything else uses existing Supabase + AI Gateway keys.
