import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { claimWebhookEvent, completeWebhookEvent } from "@/lib/webhook-dedup";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const isNew = await claimWebhookEvent("stripe", event.id, event.type);
  if (!isNew) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const supabase = createAdminClient();

  try {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      const credits = parseInt(session.metadata?.credits ?? "0", 10);

      if (orgId && credits > 0) {
        await supabase.rpc("add_credits", {
          p_user_id: orgId,
          p_amount: credits,
        });

        logAudit(supabase, {
          orgId,
          userId: session.metadata?.user_id ?? null,
          action: "credits.purchased",
          resourceType: "organization",
          resourceId: orgId,
          metadata: { credits, session_id: session.id },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;

      if (orgId) {
        await supabase
          .from("organizations")
          .update({ stripe_customer_id: subscription.customer as string })
          .eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;

      if (orgId) {
        logAudit(supabase, {
          orgId,
          userId: null,
          action: "subscription.cancelled",
          resourceType: "organization",
          resourceId: orgId,
          metadata: { subscription_id: subscription.id },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId = (invoice.metadata as Record<string, string> | null)
        ?.org_id;

      if (orgId) {
        logAudit(supabase, {
          orgId,
          userId: null,
          action: "payment.failed",
          resourceType: "organization",
          resourceId: orgId,
          metadata: { invoice_id: invoice.id },
        });
      }
      break;
    }
  }

  await completeWebhookEvent("stripe", event.id, "completed");
  } catch (err) {
    await completeWebhookEvent("stripe", event.id, "failed");
    console.error("[webhook:stripe] Processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
