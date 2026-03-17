import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_WEIGHTS: Record<string, number> = {
  linear: 1.5,
  "google-drive": 1.2,
  github: 1.2,
  "github-app": 1.2,
  granola: 1.0,
  slack: 0.7,
  discord: 0.7,
  upload: 1.0,
};

const patchSchema = z.object({
  provider: z.string().min(1),
  weight: z.number().min(0.1).max(2.0),
});

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });

  // Get distinct source_type + trust_weight for this org
  const { data: rows, error } = await supabase
    .from("context_items")
    .select("source_type, trust_weight")
    .eq("org_id", member.org_id)
    .order("source_type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build weights map: use first row per source_type (they should all match)
  const weights: Record<string, number> = { ...DEFAULT_WEIGHTS };
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    if (row.source_type && !seen.has(row.source_type)) {
      seen.add(row.source_type);
      weights[row.source_type] = row.trust_weight ?? 1.0;
    }
  }

  return NextResponse.json({ weights });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { provider, weight } = parsed.data;

  const { error } = await supabase
    .from("context_items")
    .update({ trust_weight: weight })
    .eq("org_id", member.org_id)
    .eq("source_type", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, provider, weight });
}
