import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { saveLibraryAsset } from "@/lib/library/domain";

export async function POST(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await saveLibraryAsset(auth.supabase, auth.orgId, auth.user.id, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
