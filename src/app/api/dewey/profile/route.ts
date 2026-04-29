import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { getOrCreateDeweyProfile, updateDeweyProfile } from "@/lib/library/domain";

export async function GET() {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const result = await getOrCreateDeweyProfile(auth.supabase, auth.orgId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await getOrCreateDeweyProfile(auth.supabase, auth.orgId);
  const result = await updateDeweyProfile(auth.supabase, auth.orgId, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
