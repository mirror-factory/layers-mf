import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  verifyLinearSignature,
  priorityLabel,
  buildIssueContent,
  buildIssueMetadata,
  buildCommentContent,
} from "@/lib/integrations/linear";
import { claimWebhookEvent, completeWebhookEvent, hashPayload } from "@/lib/webhook-dedup";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

// ── Linear Webhook Event Types ──────────────────────────────────────────────

interface LinearWebhookEvent {
  action: "create" | "update" | "remove";
  type: "Issue" | "Comment" | "Project" | "Cycle";
  data: Record<string, unknown>;
  url?: string;
  createdAt: string;
  organizationId?: string;
}

export async function POST(request: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("linear-signature") ?? "";

  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook:linear] LINEAR_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify HMAC-SHA256 signature
  if (!verifyLinearSignature(rawBody, signature, secret)) {
    console.warn("[webhook:linear] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: LinearWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Linear doesn't provide a unique delivery ID in headers,
  // so derive one from the event data (type + action + data.id + createdAt)
  const dataId = (event.data as Record<string, unknown>)?.id as string | undefined;
  const eventId = dataId
    ? `${event.type}-${event.action}-${dataId}`
    : hashPayload(rawBody);
  const eventTypeLabel = `${event.type}.${event.action}`;

  // Idempotency: skip if already processed
  const isNew = await claimWebhookEvent("linear", eventId, eventTypeLabel);
  if (!isNew) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // Return 200 immediately, process async
  const response = NextResponse.json({ received: true });

  // Fire-and-forget processing
  processWebhookEvent(event)
    .then(() => completeWebhookEvent("linear", eventId, "completed"))
    .catch((err) => {
      console.error("[webhook:linear] Processing error:", err);
      completeWebhookEvent("linear", eventId, "failed");
    });

  return response;
}

// ── Async Event Processing ──────────────────────────────────────────────────

async function processWebhookEvent(event: LinearWebhookEvent): Promise<void> {
  const supabase = createAdminClient();

  // Find integration by matching Linear organization ID
  const orgLinearId = event.organizationId;
  if (!orgLinearId) {
    console.warn("[webhook:linear] No organizationId in event");
    return;
  }

  // Look up the integration by matching the Linear organization ID stored in sync_config.
  // This supports multi-tenant: multiple orgs can connect to different Linear workspaces.
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("provider", "linear")
    .eq("status", "active")
    .eq("sync_config->>provider_workspace_id", orgLinearId)
    .maybeSingle();

  // Fallback: if no match by workspace ID (e.g. older integrations without sync_config),
  // try to find any active Linear integration and backfill the workspace ID.
  const resolvedIntegration = integration ?? await (async () => {
    const { data: fallback } = await supabase
      .from("integrations")
      .select("org_id")
      .eq("provider", "linear")
      .eq("status", "active")
      .is("sync_config", null)
      .limit(1)
      .maybeSingle();
    if (fallback) {
      // Backfill the provider_workspace_id for future lookups
      await supabase
        .from("integrations")
        .update({ sync_config: { provider_workspace_id: orgLinearId } })
        .eq("org_id", fallback.org_id)
        .eq("provider", "linear");
    }
    return fallback;
  })();

  if (!resolvedIntegration) {
    console.warn(`[webhook:linear] No active Linear integration found for workspace ${orgLinearId}`);
    return;
  }

  const orgId = resolvedIntegration.org_id;

  switch (event.type) {
    case "Issue":
      await handleIssueEvent(supabase, orgId, event);
      break;
    case "Comment":
      await handleCommentEvent(supabase, orgId, event);
      break;
    case "Project":
      await handleProjectEvent(supabase, orgId, event);
      break;
    case "Cycle":
      await handleCycleEvent(supabase, orgId, event);
      break;
    default:
      console.log(`[webhook:linear] Unhandled event type: ${event.type}`);
  }
}

// ── Issue Handler ───────────────────────────────────────────────────────────

async function handleIssueEvent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  event: LinearWebhookEvent
): Promise<void> {
  const data = event.data;
  const issueId = data.id as string;

  if (event.action === "remove") {
    await supabase
      .from("context_items")
      .update({ status: "archived" })
      .eq("org_id", orgId)
      .eq("source_type", "linear")
      .eq("source_id", issueId);
    return;
  }

  // Build issue-like object from webhook data
  const identifier = (data.identifier as string) ?? "";
  const title = (data.title as string) ?? "Untitled Issue";
  const description = (data.description as string) ?? "";
  const stateData = data.state as { name?: string } | undefined;
  const assigneeData = data.assignee as { name?: string } | undefined;
  const priority = (data.priority as number) ?? 0;
  const labelsData = data.labels as { name: string }[] | undefined;
  const teamData = data.team as { name?: string; key?: string } | undefined;
  const url = (data.url as string) ?? event.url ?? "";

  const content = buildIssueContent({
    id: issueId,
    identifier,
    title,
    description,
    url,
    state: stateData ? { name: stateData.name ?? "" } : null,
    assignee: assigneeData ? { name: assigneeData.name ?? "" } : null,
    priority,
    labels: { nodes: (labelsData ?? []).map((l) => ({ name: l.name })) },
    team: teamData ? { name: teamData.name ?? "", key: teamData.key ?? "" } : null,
    comments: { nodes: [] },
    createdAt: (data.createdAt as string) ?? event.createdAt,
    updatedAt: (data.updatedAt as string) ?? event.createdAt,
  });

  const sourceMetadata = buildIssueMetadata({
    id: issueId,
    identifier,
    title,
    description,
    url,
    state: stateData ? { name: stateData.name ?? "" } : null,
    assignee: assigneeData ? { name: assigneeData.name ?? "" } : null,
    priority,
    labels: { nodes: (labelsData ?? []).map((l) => ({ name: l.name })) },
    team: teamData ? { name: teamData.name ?? "", key: teamData.key ?? "" } : null,
    comments: { nodes: [] },
    createdAt: (data.createdAt as string) ?? event.createdAt,
    updatedAt: (data.updatedAt as string) ?? event.createdAt,
  });

  const displayTitle = identifier ? `${identifier}: ${title}` : title;

  await upsertAndProcess(supabase, orgId, {
    sourceId: issueId,
    contentType: "issue",
    title: displayTitle,
    content,
    sourceMetadata,
    sourceCreatedAt: (data.createdAt as string) ?? null,
  });
}

// ── Comment Handler ─────────────────────────────────────────────────────────

async function handleCommentEvent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  event: LinearWebhookEvent
): Promise<void> {
  const data = event.data;
  const commentId = data.id as string;

  if (event.action === "remove") {
    await supabase
      .from("context_items")
      .update({ status: "archived" })
      .eq("org_id", orgId)
      .eq("source_type", "linear")
      .eq("source_id", commentId);
    return;
  }

  const body = (data.body as string) ?? "";
  if (body.length < 10) return; // Skip trivially short comments

  const issueData = data.issue as {
    id?: string;
    identifier?: string;
    title?: string;
  } | undefined;

  const userData = data.user as { name?: string } | undefined;

  const content = buildCommentContent(
    {
      id: commentId,
      body,
      user: userData ? { name: userData.name ?? "" } : null,
      issue: issueData
        ? {
            id: issueData.id ?? "",
            identifier: issueData.identifier ?? "",
            title: issueData.title ?? "",
          }
        : null,
      createdAt: (data.createdAt as string) ?? event.createdAt,
      updatedAt: (data.updatedAt as string) ?? event.createdAt,
    },
    issueData?.title,
    issueData?.identifier
  );

  const displayTitle = issueData?.identifier
    ? `Comment on ${issueData.identifier}: ${issueData.title ?? ""}`
    : "Linear Comment";

  await upsertAndProcess(supabase, orgId, {
    sourceId: commentId,
    contentType: "comment",
    title: displayTitle,
    content,
    sourceMetadata: {
      parentIssueId: issueData?.id ?? null,
      parentIssueIdentifier: issueData?.identifier ?? null,
      author: userData?.name ?? null,
    },
    sourceCreatedAt: (data.createdAt as string) ?? null,
  });
}

// ── Project Handler ─────────────────────────────────────────────────────────

async function handleProjectEvent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  event: LinearWebhookEvent
): Promise<void> {
  const data = event.data;
  const projectId = data.id as string;

  if (event.action === "remove") {
    await supabase
      .from("context_items")
      .update({ status: "archived" })
      .eq("org_id", orgId)
      .eq("source_type", "linear")
      .eq("source_id", projectId);
    return;
  }

  const name = (data.name as string) ?? "Untitled Project";
  const description = (data.description as string) ?? "";
  const state = (data.state as string) ?? "";
  const url = (data.url as string) ?? "";
  const leadData = data.lead as { name?: string } | undefined;
  const progress = (data.progress as number) ?? 0;
  const startDate = (data.startDate as string) ?? null;
  const targetDate = (data.targetDate as string) ?? null;

  const meta: string[] = [];
  if (state) meta.push(`State: ${state}`);
  if (leadData?.name) meta.push(`Lead: ${leadData.name}`);
  meta.push(`Progress: ${Math.round(progress * 100)}%`);
  if (startDate) meta.push(`Start: ${startDate}`);
  if (targetDate) meta.push(`Target: ${targetDate}`);

  const content = [description, "", meta.join(" | ")]
    .join("\n")
    .slice(0, 12000);

  await upsertAndProcess(supabase, orgId, {
    sourceId: projectId,
    contentType: "project",
    title: `Project: ${name}`,
    content,
    sourceMetadata: {
      url,
      state,
      lead: leadData?.name ?? null,
      progress,
      startDate,
      targetDate,
    },
    sourceCreatedAt: (data.createdAt as string) ?? null,
  });
}

// ── Cycle Handler ───────────────────────────────────────────────────────────

async function handleCycleEvent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  event: LinearWebhookEvent
): Promise<void> {
  const data = event.data;
  const cycleId = data.id as string;

  if (event.action === "remove") {
    await supabase
      .from("context_items")
      .update({ status: "archived" })
      .eq("org_id", orgId)
      .eq("source_type", "linear")
      .eq("source_id", cycleId);
    return;
  }

  const number = (data.number as number) ?? 0;
  const name = (data.name as string) ?? null;
  const description = (data.description as string) ?? "";
  const startsAt = (data.startsAt as string) ?? "";
  const endsAt = (data.endsAt as string) ?? "";
  const progress = (data.progress as number) ?? 0;
  const teamData = data.team as { name?: string; key?: string } | undefined;
  const completedAt = (data.completedAt as string) ?? null;

  const meta: string[] = [];
  meta.push(`Cycle #${number}`);
  if (teamData?.name) meta.push(`Team: ${teamData.name}`);
  meta.push(`Progress: ${Math.round(progress * 100)}%`);
  if (startsAt) meta.push(`Starts: ${startsAt}`);
  if (endsAt) meta.push(`Ends: ${endsAt}`);
  if (completedAt) meta.push(`Completed: ${completedAt}`);

  const content = [description, "", meta.join(" | ")]
    .join("\n")
    .slice(0, 12000);

  const displayTitle = name
    ? `Cycle #${number}: ${name}`
    : `Cycle #${number}`;

  await upsertAndProcess(supabase, orgId, {
    sourceId: cycleId,
    contentType: "cycle",
    title: displayTitle,
    content,
    sourceMetadata: {
      number,
      team: teamData?.name ?? null,
      progress,
      startsAt,
      endsAt,
      completedAt,
    },
    sourceCreatedAt: (data.createdAt as string) ?? null,
  });
}

// ── Shared Upsert + Process ─────────────────────────────────────────────────

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
  const { sourceId, contentType, title, content, sourceMetadata, sourceCreatedAt } = params;

  if (!content || content.trim().length < 10) return;

  // Check for existing item
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
      console.error(`[webhook:linear] DB insert error for ${sourceId}:`, error?.message);
      return;
    }
    itemId = inserted.id;
  }

  // Run AI extraction + embedding pipeline
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
    console.error(`[webhook:linear] Pipeline error for ${sourceId}:`, err);
    await supabase
      .from("context_items")
      .update({ status: "error" })
      .eq("id", itemId);
  }
}
