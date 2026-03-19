import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLAN_TIERS, getPlanFromPriceId } from "@/lib/stripe";
import type { PlanTier } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * GET /api/billing/subscription
 * Returns current subscription details for the user's org.
 */
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
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id, credit_balance")
    .eq("id", member.org_id)
    .single();

  // Default free plan response
  let plan: PlanTier = "free";
  let status = "active";
  let creditsPerMonth: number = PLAN_TIERS.free.credits_per_month;
  let currentPeriodEnd: string | null = null;
  let cancelAtPeriodEnd = false;

  // If org has a Stripe customer, look up active subscription
  if (org?.stripe_customer_id) {
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    const sub = subscriptions.data[0];
    if (sub) {
      const priceId = sub.items.data[0]?.price?.id ?? null;
      plan = getPlanFromPriceId(priceId);
      creditsPerMonth = PLAN_TIERS[plan].credits_per_month;
      status = sub.status;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const periodEnd = (sub as any).current_period_end as number | undefined;
      if (periodEnd) {
        currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
      }
      cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
    }
  }

  return NextResponse.json({
    plan,
    status,
    credits_per_month: creditsPerMonth,
    credits_remaining: org?.credit_balance ?? 0,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
  });
}

/**
 * POST /api/billing/subscription
 * Create a Stripe Checkout session for a subscription plan.
 * Body: { plan: "starter" | "pro" }
 */
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
      { error: "Only owners and admins can manage subscriptions" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const plan = body.plan as PlanTier;

  if (!plan || plan === "free") {
    return NextResponse.json(
      { error: "Cannot subscribe to free plan via checkout" },
      { status: 400 }
    );
  }

  const tier = PLAN_TIERS[plan];
  if (!tier || !tier.price_id) {
    return NextResponse.json(
      { error: "Invalid plan or plan not configured" },
      { status: 400 }
    );
  }

  // Get or reference existing Stripe customer
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", member.org_id)
    .single();

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: tier.price_id, quantity: 1 }],
    metadata: {
      org_id: member.org_id,
      user_id: user.id,
      plan,
    },
    subscription_data: {
      metadata: {
        org_id: member.org_id,
        plan,
      },
    },
    success_url: `${origin}/settings/billing?success=true`,
    cancel_url: `${origin}/settings/billing?cancelled=true`,
  };

  if (org?.stripe_customer_id) {
    sessionParams.customer = org.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}

/**
 * DELETE /api/billing/subscription
 * Cancel the current subscription (at period end).
 */
export async function DELETE() {
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
      { error: "Only owners and admins can manage subscriptions" },
      { status: 403 }
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", member.org_id)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 }
    );
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: org.stripe_customer_id,
    status: "active",
    limit: 1,
  });

  const sub = subscriptions.data[0];
  if (!sub) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 400 }
    );
  }

  await stripe.subscriptions.update(sub.id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({
    status: "canceled",
    cancel_at_period_end: true,
  });
}
