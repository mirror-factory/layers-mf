import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("credit_balance, stripe_customer_id")
    .eq("id", member.org_id)
    .single();

  return NextResponse.json({
    credits: org?.credit_balance ?? 0,
    hasStripeCustomer: !!org?.stripe_customer_id,
    orgId: member.org_id,
  });
}
