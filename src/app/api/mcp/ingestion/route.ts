import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import {
  createLibraryItem,
  createMcpImportBatch,
  createMcpSyncRule,
  describeMcpIngestionMode,
} from "@/lib/library/domain";
import type { McpIngestionMode } from "@/lib/library/types";

const MODES = new Set(["live_lookup", "save_selected", "sync_rule"]);

export async function POST(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const body = await request.json().catch(() => null);
  const mode = body?.mode as McpIngestionMode | undefined;
  if (!mode || !MODES.has(mode)) {
    return NextResponse.json(
      { error: "mode must be live_lookup, save_selected, or sync_rule" },
      { status: 400 },
    );
  }

  if (mode === "live_lookup") {
    const batch = await createMcpImportBatch(auth.supabase, {
      orgId: auth.orgId,
      userId: auth.user.id,
      mcpServerId: body.mcpServerId,
      mode,
      query: body.query,
      status: "completed",
      metadata: { resultPreview: body.resultPreview ?? null },
    });
    return NextResponse.json({
      mode: describeMcpIngestionMode(mode),
      batch,
      saved: [],
    });
  }

  if (mode === "save_selected") {
    const records = Array.isArray(body.records) ? body.records : [];
    const invalidRecord = records.find((record: Record<string, unknown>) => {
      return typeof record.title !== "string" || !record.title.trim();
    });
    if (invalidRecord) {
      return NextResponse.json(
        { error: "Each selected MCP record must include a title" },
        { status: 400 },
      );
    }

    const saved = [];
    for (const record of records) {
      const result = await createLibraryItem(auth.supabase, {
        orgId: auth.orgId,
        userId: auth.user.id,
        title: record.title.trim(),
        body: record.body ?? record.text ?? record.content,
        summary: record.summary,
        itemType: record.itemType,
        stackIds: body.stackIds,
        tags: record.tags ?? body.tags,
        source: {
          sourceKind: "mcp",
          provider: record.provider ?? body.provider,
          mcpServerId: body.mcpServerId,
          externalId: record.externalId ?? record.id,
          externalUrl: record.externalUrl ?? record.url,
          importMode: "save_selected",
          metadata: record.metadata ?? record,
        },
      });
      if ("item" in result) saved.push(result.item);
    }

    const batch = await createMcpImportBatch(auth.supabase, {
      orgId: auth.orgId,
      userId: auth.user.id,
      mcpServerId: body.mcpServerId,
      mode,
      query: body.query,
      selectedCount: records.length,
      savedCount: saved.length,
      status: "completed",
    });

    return NextResponse.json({ mode: describeMcpIngestionMode(mode), batch, saved });
  }

  if (typeof body.mcpServerId !== "string" || !body.mcpServerId) {
    return NextResponse.json({ error: "mcpServerId is required for sync_rule" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Sync rule name is required" }, { status: 400 });
  }

  const syncRule = await createMcpSyncRule(auth.supabase, {
    orgId: auth.orgId,
    userId: auth.user.id,
    mcpServerId: body.mcpServerId,
    name: body.name.trim(),
    toolName: body.toolName,
    query: body.query,
    selector: body.selector,
    destinationStackId: body.destinationStackId,
    itemType: body.itemType,
    cadence: body.cadence,
    approvalRequired: body.approvalRequired,
    metadata: body.metadata,
  });

  if ("error" in syncRule) {
    return NextResponse.json({ error: syncRule.error }, { status: 400 });
  }

  return NextResponse.json({
    mode: describeMcpIngestionMode(mode),
    syncRule,
  }, { status: 201 });
}
