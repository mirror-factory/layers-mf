import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { getLibraryItem } from "@/lib/library/domain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const result = await getLibraryItem(auth.supabase, auth.orgId, id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
