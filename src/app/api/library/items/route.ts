import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { createLibraryItem, listLibraryItems } from "@/lib/library/domain";

export async function GET(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const url = new URL(request.url);
  const result = await listLibraryItems(auth.supabase, auth.orgId, {
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
    itemType: url.searchParams.get("itemType") ?? undefined,
    stackId: url.searchParams.get("stackId") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await createLibraryItem(auth.supabase, {
    orgId: auth.orgId,
    userId: auth.user.id,
    title: body.title.trim(),
    body: body.body,
    summary: body.summary,
    itemType: body.itemType,
    contentType: body.contentType,
    sourceType: body.sourceType,
    sourceId: body.sourceId,
    source: body.source,
    stackIds: body.stackIds,
    tags: body.tags,
    assets: body.assets,
    permissions: body.permissions,
    metadata: body.metadata,
    status: body.status,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
