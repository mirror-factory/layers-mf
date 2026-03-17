import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const { id, versionNumber } = await params;
  const versionNum = parseInt(versionNumber, 10);

  if (isNaN(versionNum) || versionNum < 1) {
    return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  const { data: version, error } = await supabase
    .from("context_item_versions")
    .select(
      "version_number, title, raw_content, content_hash, source_metadata, change_type, changed_fields, changed_by, created_at, source_updated_at",
    )
    .eq("context_item_id", id)
    .eq("org_id", member.org_id)
    .eq("version_number", versionNum)
    .single();

  if (error || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json(version);
}
