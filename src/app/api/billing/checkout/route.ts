import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, CREDIT_PACKAGES } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can purchase credits" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const packageId = body.packageId as string;
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);

  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: pkg.label },
          unit_amount: pkg.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      org_id: member.org_id,
      user_id: user.id,
      credits: String(pkg.credits),
      package_id: pkg.id,
    },
    success_url: `${origin}/settings/billing?success=true`,
    cancel_url: `${origin}/settings/billing?cancelled=true`,
  });

  return NextResponse.json({ url: session.url });
}
