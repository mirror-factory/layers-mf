import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe, PLAN_TIERS, getPlanFromPriceId } from "@/lib/stripe";
import type { PlanTier } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/credit-reset
 * Monthly cron (1st of each month) — resets credits based on plan tier.
 * Carry-over capped at 2x monthly allocation.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id, credit_balance");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    return Response.json({ processed: 0 });
  }

  let processed = 0;
  let resetCount = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    try {
      processed++;

      // Determine plan tier
      let plan: PlanTier = "free";

      if (org.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({
          customer: org.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        const sub = subscriptions.data[0];
        if (sub) {
          const priceId = sub.items.data[0]?.price?.id ?? null;
          plan = getPlanFromPriceId(priceId);
        }
      }

      const monthlyAllocation = PLAN_TIERS[plan].credits_per_month;
      const maxCarryOver = monthlyAllocation * 2;
      const currentBalance = org.credit_balance ?? 0;

      // New balance = monthly allocation + carry-over (capped at 2x)
      const carryOver = Math.min(currentBalance, maxCarryOver);
      const newBalance = Math.min(monthlyAllocation + carryOver, maxCarryOver);

      await supabase
        .from("organizations")
        .update({ credit_balance: newBalance })
        .eq("id", org.id);

      logAudit(supabase, {
        orgId: org.id,
        userId: null,
        action: "credits.monthly_reset",
        resourceType: "organization",
        resourceId: org.id,
        metadata: {
          plan,
          monthly_allocation: monthlyAllocation,
          previous_balance: currentBalance,
          carry_over: carryOver,
          new_balance: newBalance,
        },
      });

      resetCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`org ${org.id}: ${message}`);
    }
  }

  return Response.json({
    processed,
    reset: resetCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
