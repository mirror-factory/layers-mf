import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { createContextPack, listContextPacks } from "@/lib/library/domain";

export async function GET() {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const result = await listContextPacks(auth.supabase, auth.orgId);
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

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Context pack name is required" }, { status: 400 });
  }

  const result = await createContextPack(auth.supabase, {
    orgId: auth.orgId,
    userId: auth.user.id,
    name: body.name.trim(),
    purpose: body.purpose,
    visibility: body.visibility,
    retrievalQuery: body.retrievalQuery,
    instructions: body.instructions,
    itemIds: body.itemIds,
    metadata: body.metadata,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
