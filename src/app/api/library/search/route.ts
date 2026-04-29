import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { listLibraryItems } from "@/lib/library/domain";

export async function POST(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const result = await listLibraryItems(auth.supabase, auth.orgId, {
    query,
    limit: body.limit,
    itemType: body.itemType,
    stackId: body.stackId,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
