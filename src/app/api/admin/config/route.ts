import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;
  const { data, error } = await adminDb
    .from("platform_config")
    .select("key, value");

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }

  const config: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    config[row.key] = row.value;
  }

  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { key, value } = body as { key: string; value: unknown };

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "Missing key or value" },
      { status: 400 }
    );
  }

  const validKeys = ["model_pricing", "credit_config", "credit_packages"];
  if (!validKeys.includes(key)) {
    return NextResponse.json({ error: "Invalid config key" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;
  const { error } = await adminDb
    .from("platform_config")
    .upsert(
      {
        key,
        value: value as Record<string, unknown>,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" }
    );

  if (error) {
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
