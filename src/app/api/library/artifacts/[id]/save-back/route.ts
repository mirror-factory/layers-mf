import { NextRequest, NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { saveArtifactBackToLibrary } from "@/lib/library/domain";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const result = await saveArtifactBackToLibrary(auth.supabase, {
    orgId: auth.orgId,
    userId: auth.user.id,
    artifactId: id,
    stackIds: Array.isArray(body.stackIds) ? body.stackIds.filter(Boolean) : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : undefined,
    reason: typeof body.reason === "string" ? body.reason : "manual_save_back",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ saved: true, item: result.item });
}
