import Link from "next/link";
import {
  Plug,
  Search,
  Brain,
  Users,
  ArrowRight,
  Check,
} from "lucide-react";

const FEATURES = [
  {
    icon: Plug,
    title: "Connect Everything",
    description:
      "Connect any tool via MCP servers. Slack, GitHub, Linear, Notion, Google Drive, and more out of the box.",
  },
  {
    icon: Search,
    title: "Search Across Tools",
    description:
      "Hybrid vector + keyword search finds exactly what you need across every connected source in milliseconds.",
  },
  {
    icon: Brain,
    title: "AI That Understands Context",
    description:
      "Chat with citations across all your sources. Every answer is grounded in your team's real data.",
  },
  {
    icon: Users,
    title: "Team Knowledge Base",
    description:
      "Meetings, docs, issues, and messages in one place. No more context-switching between tools.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Connect your tools",
    description:
      "Link Slack, GitHub, Linear, Notion, Google Drive, Jira, and hundreds more with one-click OAuth.",
  },
  {
    step: "02",
    title: "Content is automatically processed",
    description:
      "Our AI pipeline chunks, embeds, and indexes everything. Smart deduplication keeps your context clean.",
  },
  {
    step: "03",
    title: "Ask questions, get answers",
    description:
      "Chat with your entire knowledge base. Every response includes citations so you can verify and trace back to the source.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals exploring Granger",
    features: [
      "50 credits/month",
      "1 user",
      "3 integrations",
      "Community support",
    ],
    cta: "Meet Granger",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    description: "For small teams getting started",
    features: [
      "500 credits/month",
      "5 users",
      "Unlimited integrations",
      "Email support",
      "Priority processing",
    ],
    cta: "Coming Soon",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For teams that need more power",
    features: [
      "5,000 credits/month",
      "Unlimited users",
      "Unlimited integrations",
      "Priority support",
      "Advanced analytics",
      "API access",
    ],
    cta: "Coming Soon",
    href: "/signup",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Your AI{" "}
          <span className="text-primary">Chief of Staff</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Granger connects every tool into a single context layer and deploys
          intelligent agents that understand what&apos;s happening across your business.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Meet Granger
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/features"
            className="inline-flex h-11 items-center gap-2 rounded-md border px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            See Features
          </Link>
        </div>
      </section>

      {/* Features overview */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything your team needs in one place
            </h2>
            <p className="mt-3 text-muted-foreground">
              Stop context-switching. Start building with full context.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6"
              >
                <feature.icon className="mb-4 h-8 w-8 text-primary" />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps to full team context.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Scale when you&apos;re ready.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border bg-card p-6 ${
                  plan.highlighted
                    ? "ring-2 ring-primary relative"
                    : ""
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
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
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
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to connect your team&apos;s knowledge?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sign up in seconds. No credit card required.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Meet Granger
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
