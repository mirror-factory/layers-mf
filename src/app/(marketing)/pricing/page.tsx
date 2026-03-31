import Link from "next/link";
import { Check, X } from "lucide-react";

export const metadata = {
  title: "Pricing | Granger",
  description: "Simple, transparent pricing for teams of all sizes.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals exploring Granger",
    cta: "Meet Granger",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    description: "For small teams getting started",
    cta: "Coming Soon",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For teams that need more power",
    cta: "Coming Soon",
    href: "/signup",
    highlighted: false,
  },
];

interface FeatureRow {
  feature: string;
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
}

const COMPARISON: FeatureRow[] = [
  { feature: "Credits per month", free: "50", starter: "500", pro: "5,000" },
  { feature: "Team members", free: "1", starter: "5", pro: "Unlimited" },
  { feature: "Integrations", free: "3", starter: "Unlimited", pro: "Unlimited" },
  { feature: "Context search", free: true, starter: true, pro: true },
  { feature: "AI chat with citations", free: true, starter: true, pro: true },
  { feature: "Priority processing", free: false, starter: true, pro: true },
  { feature: "Email support", free: false, starter: true, pro: true },
  { feature: "Priority support", free: false, starter: false, pro: true },
  { feature: "Advanced analytics", free: false, starter: false, pro: true },
  { feature: "API access", free: false, starter: false, pro: true },
  { feature: "Custom integrations", free: false, starter: false, pro: true },
];

const FAQ = [
  {
    q: "What are credits?",
    a: "Credits are used for AI-powered operations like context processing, search, and chat. Each query or document processed costs a certain number of credits depending on complexity.",
  },
  {
    q: "Can I upgrade or downgrade at any time?",
    a: "Yes. You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the end of your billing cycle.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "On the Free plan, you'll need to wait until your credits reset at the start of the next month. Paid plans can purchase additional credit packs.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Free plan lets you explore all core features. When paid plans launch, we'll offer a 14-day free trial so you can test the full experience.",
  },
  {
    q: "How do integrations work?",
    a: "Integrations connect your existing tools (Slack, GitHub, Linear, Notion, etc.) to Granger via OAuth. Once connected, content is automatically synced and indexed.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted at rest and in transit. We use row-level security in our database, and your data is never shared across organizations.",
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-primary mx-auto" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

export default function PricingPage() {
  return (
    <div>
      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Start free. Scale when you&apos;re ready. No hidden fees.
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg border bg-card p-6 ${
                plan.highlighted ? "ring-2 ring-primary relative" : ""
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <Link
                href={plan.href}
                className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Feature comparison */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="mb-8 text-center text-2xl font-bold">
          Feature comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-sm font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="py-3 px-4 text-center text-sm font-medium">
                  Free
                </th>
                <th className="py-3 px-4 text-center text-sm font-medium">
                  Starter
                </th>
                <th className="py-3 px-4 text-center text-sm font-medium">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b">
                  <td className="py-3 pr-4 text-sm">{row.feature}</td>
                  <td className="py-3 px-4 text-center">
                    <CellValue value={row.free} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CellValue value={row.starter} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CellValue value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-sm font-semibold">{q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Start building with full context
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sign up in seconds. No credit card required.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Meet Granger
          </Link>
        </div>
      </section>
    </div>
  );
}
