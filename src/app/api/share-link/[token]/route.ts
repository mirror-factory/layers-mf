import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

/**
 * GET /api/share-link/[token] — Fetch shared resource by token (public endpoint)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const adminDb = createAdminClient() as unknown as AnyDb;

  // Look up the share
  const { data: share } = await adminDb
    .from("public_content_shares")
    .select("id, resource_type, resource_id, org_id, is_active, allow_public_view, expires_at, shared_by, created_at")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (!share) {
    return NextResponse.json({ error: "Share not found or inactive" }, { status: 404 });
  }

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
  }

  // For org-only shares, verify the viewer is in the org
  if (!share.allow_public_view) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", share.org_id)
      .single();
    if (!member) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  // Fetch resource data based on type
  const resourceType = share.resource_type as string;
  const resourceId = share.resource_id as string;

  if (resourceType === "context_item") {
    const { data: item } = await adminDb
      .from("context_items")
      .select("id, title, description_short, description_long, source_type, content_type, raw_content, status, ingested_at")
      .eq("id", resourceId)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    return NextResponse.json({
      resource_type: "context_item",
      created_at: share.created_at,
      data: item,
    });
  }

  if (resourceType === "artifact") {
    const { data: artifact } = await adminDb
      .from("artifacts")
      .select("id, title, description, artifact_type, content, language, current_version, created_at, updated_at")
      .eq("id", resourceId)
      .single();

    if (!artifact) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Also fetch files if multi-file artifact
    const { data: files } = await adminDb
      .from("artifact_files")
      .select("file_path, content, language")
      .eq("artifact_id", resourceId)
      .order("file_path", { ascending: true });

    return NextResponse.json({
      resource_type: "artifact",
      created_at: share.created_at,
      data: { ...artifact, files: files ?? [] },
    });
  }

  if (resourceType === "skill") {
    const { data: skill } = await adminDb
      .from("skills")
      .select("id, name, slug, description, instructions, category, is_active, created_at")
      .eq("id", resourceId)
      .single();

    if (!skill) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    return NextResponse.json({
      resource_type: "skill",
      created_at: share.created_at,
      data: skill,
    });
  }

  return NextResponse.json({ error: "Unknown resource type" }, { status: 400 });
}
