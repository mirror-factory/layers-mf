import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 }
    );
  }

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("id, provider, sync_config")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: integration.id,
    provider: integration.provider,
    sync_config: integration.sync_config ?? {},
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 }
    );
  }

  // Verify integration belongs to user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, sync_config")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  let syncConfig: Record<string, unknown>;
  try {
    const body = await request.json();
    syncConfig = body.sync_config;
    if (!syncConfig || typeof syncConfig !== "object") {
      throw new Error("invalid");
    }
  } catch {
    return NextResponse.json(
      { error: "sync_config object required" },
      { status: 400 }
    );
  }

  // Merge with existing sync_config to preserve other keys (e.g. Google Drive watch metadata)
  const existingConfig =
    (integration.sync_config as Record<string, unknown>) ?? {};
  const mergedConfig = { ...existingConfig, ...syncConfig };

  const { error } = await supabase
    .from("integrations")
    .update({ sync_config: mergedConfig as unknown as Json })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sync_config: mergedConfig });
}
