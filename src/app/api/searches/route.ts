import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  // Fetch user's own searches + shared searches from the org
  const { data: ownSearches, error: ownError } = await supabase
    .from("saved_searches")
    .select("id, name, query, filters, is_shared, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: sharedSearches, error: sharedError } = await supabase
    .from("saved_searches")
    .select("id, name, query, filters, is_shared, created_at")
    .eq("org_id", member.org_id)
    .eq("is_shared", true)
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (ownError || sharedError) {
    return NextResponse.json(
      { error: (ownError ?? sharedError)!.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    searches: [...(ownSearches ?? []), ...(sharedSearches ?? [])],
  });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.query) {
    return NextResponse.json(
      { error: "name and query are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      org_id: member.org_id,
      user_id: user.id,
      name: body.name,
      query: body.query,
      filters: body.filters ?? {},
      is_shared: body.is_shared ?? false,
    })
    .select("id, name, query, filters, is_shared, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
