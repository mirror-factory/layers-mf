import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import {
  assignLibraryItemToStacks,
  createLibraryItem,
} from "@/lib/library/domain";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const { data: inboxItem, error } = await auth.supabase
    .from("inbox_items")
    .select("id, title, body, type, priority, source_type, source_url, context_item_id, user_id")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .single();

  if (error || !inboxItem) {
    return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
  }

  if (inboxItem.user_id && inboxItem.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stackIds = Array.isArray(body.stackIds) ? body.stackIds.filter(Boolean) : [];
  const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
  const itemType = typeof body.itemType === "string" && body.itemType.trim()
    ? body.itemType.trim()
    : inboxItem.type ?? "note";

  let contextItemId = inboxItem.context_item_id as string | null;
  let result: Awaited<ReturnType<typeof createLibraryItem>> | { item: { id: string } };

  if (contextItemId) {
    if (stackIds.length > 0) {
      await assignLibraryItemToStacks(auth.supabase, {
        orgId: auth.orgId,
        itemId: contextItemId,
        stackIds,
        userId: auth.user.id,
      });
    }
    result = { item: { id: contextItemId } };
  } else {
    result = await createLibraryItem(auth.supabase, {
      orgId: auth.orgId,
      userId: auth.user.id,
      title: inboxItem.title,
      body: inboxItem.body ?? "",
      summary: inboxItem.body?.slice(0, 500) ?? inboxItem.title,
      itemType,
      contentType: itemType === "decision" || itemType === "action_item" ? "document" : itemType,
      sourceType: inboxItem.source_type ?? "inbox",
      sourceId: inboxItem.id,
      source: {
        sourceKind: "inbox",
        provider: inboxItem.source_type ?? "layers",
        externalId: inboxItem.id,
        externalUrl: inboxItem.source_url ?? undefined,
        importMode: "manual",
        metadata: {
          inboxType: inboxItem.type,
          priority: inboxItem.priority,
        },
      },
      stackIds,
      tags,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    contextItemId = result.item.id;
  }

  await auth.supabase
    .from("inbox_items")
    .update({
      status: "acted",
      read_at: new Date().toISOString(),
      context_item_id: contextItemId,
    })
    .eq("id", id)
    .eq("org_id", auth.orgId);

  return NextResponse.json({
    curated: true,
    inboxItemId: id,
    contextItemId,
  });
}
