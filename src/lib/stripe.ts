import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
  });

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const client = getStripeClient();
    const value = client[property as keyof Stripe];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Subscription plan tiers */
export const PLAN_TIERS = {
  free: { name: "Free", credits_per_month: 50, price_id: null },
  starter: {
    name: "Starter",
    credits_per_month: 500,
    price_id: process.env.STRIPE_STARTER_PRICE_ID ?? null,
  },
  pro: {
    name: "Pro",
    credits_per_month: 5000,
    price_id: process.env.STRIPE_PRO_PRICE_ID ?? null,
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

/**
 * Determine plan tier from a Stripe subscription's price ID.
 * Returns "free" if no match found.
 */
export function getPlanFromPriceId(priceId: string | null): PlanTier {
  if (!priceId) return "free";
  if (priceId === PLAN_TIERS.starter.price_id) return "starter";
  if (priceId === PLAN_TIERS.pro.price_id) return "pro";
  return "free";
}

/** Credit packages available for purchase */
export const CREDIT_PACKAGES = [
  { id: "credits_100", credits: 100, priceInCents: 999, label: "100 credits" },
  { id: "credits_500", credits: 500, priceInCents: 3999, label: "500 credits" },
  {
    id: "credits_2000",
    credits: 2000,
    priceInCents: 12999,
    label: "2,000 credits",
  },
] as const;
