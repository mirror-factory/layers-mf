import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

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
