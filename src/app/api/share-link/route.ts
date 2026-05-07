import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

async function getAuthenticatedUserAndOrg() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return null;

  return { user, orgId: member.org_id };
}

/**
 * POST /api/share-link — Create a public share link for an artifact, context item, or skill
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const resourceType = body.resource_type as string;
  const resourceId = body.resource_id as string;
  const allowPublicView = body.allow_public_view !== false;
  const expiresAt = body.expires_at ?? null;

  if (!resourceType || !resourceId) {
    return NextResponse.json({ error: "resource_type and resource_id required" }, { status: 400 });
  }

  if (!["artifact", "context_item", "skill"].includes(resourceType)) {
    return NextResponse.json({ error: "Invalid resource_type" }, { status: 400 });
  }

  const adminDb = createAdminClient() as unknown as AnyDb;

  // Check if share already exists for this resource by this user
  const { data: existing } = await adminDb
    .from("public_content_shares")
    .select("id, share_token, is_active")
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .eq("shared_by", auth.user.id)
    .single();

  if (existing) {
    // Reactivate if deactivated
    if (!existing.is_active) {
      await adminDb
        .from("public_content_shares")
        .update({ is_active: true, allow_public_view: allowPublicView })
        .eq("id", existing.id);
    }
    return NextResponse.json({
      token: existing.share_token,
      url: `/s/${existing.share_token}`,
    });
  }

  const { data: share, error } = await adminDb
    .from("public_content_shares")
    .insert({
      org_id: auth.orgId,
      shared_by: auth.user.id,
      resource_type: resourceType,
      resource_id: resourceId,
      allow_public_view: allowPublicView,
      expires_at: expiresAt,
    })
    .select("share_token")
    .single();

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json({
    token: share.share_token,
    url: `/s/${share.share_token}`,
  });
}

/**
 * DELETE /api/share-link — Deactivate a public share link
 */
export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const token = body.token as string | undefined;
  const resourceType = body.resource_type as string | undefined;
  const resourceId = body.resource_id as string | undefined;

  const adminDb = createAdminClient() as unknown as AnyDb;

  if (token) {
    await adminDb
      .from("public_content_shares")
      .update({ is_active: false })
      .eq("share_token", token)
      .eq("shared_by", auth.user.id);
  } else if (resourceType && resourceId) {
    await adminDb
      .from("public_content_shares")
      .update({ is_active: false })
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .eq("shared_by", auth.user.id);
  } else {
    return NextResponse.json({ error: "Provide token or resource_type+resource_id" }, { status: 400 });
  }

  return NextResponse.json({ deactivated: true });
}
