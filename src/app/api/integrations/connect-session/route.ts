import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";

// Supported integrations — must match provider config keys in Nango dashboard
const ALLOWED_INTEGRATIONS = ["granola", "linear", "google-drive"];

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  try {
    const { data } = await nango.createConnectSession({
      tags: {
        end_user_id: user.id,
        end_user_email: user.email ?? "",
        organization_id: member.org_id,
      },
      allowed_integrations: ALLOWED_INTEGRATIONS,
    });

    return NextResponse.json({ sessionToken: data.token });
  } catch (err) {
    console.error("Nango createConnectSession error:", err);
    return NextResponse.json({ error: "Failed to create connect session" }, { status: 500 });
  }
}
