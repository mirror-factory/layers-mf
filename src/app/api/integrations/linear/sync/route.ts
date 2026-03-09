import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  fetchLinearIssues,
  fetchLinearProjects,
  fetchLinearCycles,
  fetchLinearOrgSlug,
  buildIssueContent,
  buildIssueMetadata,
  buildCommentContent,
  buildProjectContent,
  buildCycleContent,
  buildLinearUrl,
  type LinearIssue,
  type LinearComment,
  type LinearProject,
  type LinearCycle,
} from "@/lib/integrations/linear";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

interface SyncResult {
  issues: number;
  comments: number;
  projects: number;
  cycles: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string;
  let provider: string;
  let incremental: boolean;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider ?? "linear";
    incremental = body.incremental !== false; // default to incremental
    if (!connectionId) throw new Error("missing connectionId");
  } catch {
    return NextResponse.json(
      { error: "connectionId required" },
      { status: 400 }
    );
  }

  // Verify integration belongs to user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id, sync_config")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const orgId = integration.org_id;
  const syncConfig = (integration.sync_config as Record<string, string | undefined> | null) ?? {};
  const lastSyncAt = incremental
    ? syncConfig.lastFullSyncAt
    : undefined;

  const adminDb = createAdminClient();

  // Fetch org slug for building URLs
  const orgSlug = await fetchLinearOrgSlug(connectionId, provider);

  const result: SyncResult = {
    issues: 0,
    comments: 0,
    projects: 0,
    cycles: 0,
    errors: [],
  };

  const syncStartedAt = new Date().toISOString();

  // ── Sync Issues + Comments ────────────────────────────────────────────────

  try {
    const issues = await fetchLinearIssues(connectionId, provider, lastSyncAt);

    for (const issue of issues) {
      try {
        await upsertIssue(adminDb, orgId, issue, orgSlug);
        result.issues++;

        // Sync embedded comments
        for (const comment of issue.comments?.nodes ?? []) {
          try {
            await upsertComment(adminDb, orgId, comment, issue);
            result.comments++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Comment ${comment.id}: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Issue ${issue.identifier}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Issues fetch: ${msg}`);
  }

  // ── Sync Projects ────────────────────────────────────────────────────────

  try {
    const projects = await fetchLinearProjects(
      connectionId,
      provider,
      lastSyncAt
    );

    for (const project of projects) {
      try {
        await upsertProject(adminDb, orgId, project, orgSlug);
        result.projects++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Project ${project.name}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Projects fetch: ${msg}`);
  }

  // ── Sync Cycles ──────────────────────────────────────────────────────────

  try {
    const cycles = await fetchLinearCycles(
      connectionId,
      provider,
      lastSyncAt
    );

    for (const cycle of cycles) {
      try {
        await upsertCycle(adminDb, orgId, cycle, orgSlug);
        result.cycles++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Cycle #${cycle.number}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Cycles fetch: ${msg}`);
  }

  // ── Update sync metadata ─────────────────────────────────────────────────

  const totalProcessed =
    result.issues + result.comments + result.projects + result.cycles;

  if (totalProcessed > 0) {
    await adminDb
      .from("integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_config: {
          ...syncConfig,
          lastFullSyncAt: syncStartedAt,
          orgSlug,
        } as Json,
      })
      .eq("nango_connection_id", connectionId);
  }

  return NextResponse.json({
    processed: totalProcessed,
    ...result,
  });
}

// ── Upsert Helpers ──────────────────────────────────────────────────────────

async function upsertIssue(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  issue: LinearIssue,
  orgSlug?: string
): Promise<void> {
  const title = issue.identifier
    ? `${issue.identifier}: ${issue.title}`
    : issue.title;
  const content = buildIssueContent(issue);
  const metadata = {
    ...buildIssueMetadata(issue),
    url: issue.url || buildLinearUrl(orgSlug, "issue", issue.identifier),
  };

  await upsertAndProcess(supabase, orgId, {
    sourceId: issue.id,
    contentType: "issue",
    title,
    content,
    sourceMetadata: metadata,
    sourceCreatedAt: issue.createdAt,
  });
}

async function upsertComment(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  comment: LinearComment,
  parentIssue: LinearIssue
): Promise<void> {
  if (comment.body.length < 10) return;

  const title = `Comment on ${parentIssue.identifier}: ${parentIssue.title}`;
  const content = buildCommentContent(
    {
      ...comment,
      issue: {
        id: parentIssue.id,
        identifier: parentIssue.identifier,
        title: parentIssue.title,
      },
    },
    parentIssue.title,
    parentIssue.identifier
  );

  await upsertAndProcess(supabase, orgId, {
    sourceId: comment.id,
    contentType: "comment",
    title,
    content,
    sourceMetadata: {
      parentIssueId: parentIssue.id,
      parentIssueIdentifier: parentIssue.identifier,
      author: comment.user?.name ?? null,
    },
    sourceCreatedAt: comment.createdAt,
  });
}

async function upsertProject(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  project: LinearProject,
  orgSlug?: string
): Promise<void> {
  const content = buildProjectContent(project);
  const url =
    project.url || buildLinearUrl(orgSlug, "project", project.id);

  await upsertAndProcess(supabase, orgId, {
    sourceId: project.id,
    contentType: "project",
    title: `Project: ${project.name}`,
    content,
    sourceMetadata: {
      url,
      state: project.state,
      lead: project.lead?.name ?? null,
      progress: project.progress,
      startDate: project.startDate,
      targetDate: project.targetDate,
    },
    sourceCreatedAt: project.createdAt,
  });
}

async function upsertCycle(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  cycle: LinearCycle,
  orgSlug?: string
): Promise<void> {
  const content = buildCycleContent(cycle);
  const url = buildLinearUrl(orgSlug, "cycle", String(cycle.number));
  const title = cycle.name
    ? `Cycle #${cycle.number}: ${cycle.name}`
    : `Cycle #${cycle.number}`;

  await upsertAndProcess(supabase, orgId, {
    sourceId: cycle.id,
    contentType: "cycle",
    title,
    content,
    sourceMetadata: {
      url,
      number: cycle.number,
      team: cycle.team?.name ?? null,
      progress: cycle.progress,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      completedAt: cycle.completedAt,
    },
    sourceCreatedAt: cycle.createdAt,
  });
}

// ── Shared Upsert + Process Pipeline ────────────────────────────────────────

interface UpsertParams {
  sourceId: string;
  contentType: string;
  title: string;
  content: string;
  sourceMetadata: { [key: string]: Json | undefined };
  sourceCreatedAt: string | null;
}

async function upsertAndProcess(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  params: UpsertParams
): Promise<void> {
  const { sourceId, contentType, title, content, sourceMetadata, sourceCreatedAt } =
    params;

  if (!content || content.trim().length < 10) return;

  // Check for existing
  const { data: existing } = await supabase
    .from("context_items")
    .select("id")
    .eq("org_id", orgId)
    .eq("source_type", "linear")
    .eq("source_id", sourceId)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    await supabase
      .from("context_items")
      .update({
        title,
        raw_content: content,
        content_type: contentType,
        source_metadata: sourceMetadata as Json,
        status: "processing",
      })
      .eq("id", existing.id);
    itemId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("context_items")
      .insert({
        org_id: orgId,
        source_type: "linear",
        source_id: sourceId,
        title,
        raw_content: content,
        content_type: contentType,
        source_metadata: sourceMetadata as Json,
        status: "processing",
        source_created_at: sourceCreatedAt,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(
        `[linear:sync] DB insert error for ${sourceId}:`,
        error?.message
      );
      return;
    }
    itemId = inserted.id;
  }

  // AI extraction + embedding
  try {
    const [extraction, embedding] = await Promise.all([
      extractStructured(content, title),
      generateEmbedding(content),
    ]);

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
      .eq("id", itemId);

    await createInboxItems(supabase, orgId, itemId, extraction, "linear");
  } catch (err) {
    console.error(`[linear:sync] Pipeline error for ${sourceId}:`, err);
    await supabase
      .from("context_items")
      .update({ status: "error" })
      .eq("id", itemId);
  }
}
