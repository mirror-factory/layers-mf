"use client";

import Link from "next/link";
import {
  Play,
  Monitor,
  Wrench,
  Camera,
  Terminal,
  ArrowRight,
  Code2,
  Eye,
  Save,
  Cpu,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAPABILITIES = [
  {
    icon: Play,
    title: "Run Code",
    description:
      "Execute JavaScript, TypeScript, or Python in an isolated Linux VM.",
    usage: "Use /run or ask Granger to run a script.",
    features: ["npm / pip install", "stdout capture", "File I/O"],
  },
  {
    icon: Monitor,
    title: "Live Preview",
    description:
      "Generate HTML, CSS, and React components with instant preview.",
    usage: "Split view: code on left, live preview on right.",
    features: ["React via CDN", "Full CSS support", "Interactive widgets"],
  },
  {
    icon: Wrench,
    title: "Build Tools",
    description:
      "Create quick utilities, data processors, and automation scripts.",
    usage: "Scripts save to Context Library for reuse.",
    features: ["CSV parser", "API tester", "Report generator"],
  },
  {
    icon: Camera,
    title: "Snapshots & Persistence",
    description:
      "Sandbox VMs support snapshots for instant restore.",
    usage: "Skip dependency installation on repeated runs.",
    features: ["Up to 45 min runtime", "Persistent filesystem", "Instant restore"],
  },
] as const;

const STEPS = [
  {
    icon: Terminal,
    step: "1",
    title: "Ask Granger to build something",
    description:
      '"Create a React dashboard" or "/run fetch API data"',
  },
  {
    icon: Code2,
    step: "2",
    title: "Code generates and executes",
    description:
      "Runs in an isolated Firecracker microVM on Vercel\u2019s infrastructure.",
  },
  {
    icon: Eye,
    step: "3",
    title: "Preview in the artifact panel",
    description:
      "Code on left, live preview on right \u2014 or click Preview for full view.",
  },
  {
    icon: Save,
    step: "4",
    title: "Save and reuse",
    description:
      "All code artifacts save to Context Library for future reference.",
  },
] as const;

const SLASH_COMMANDS = [
  {
    command: "/run [description]",
    description: "Execute code in sandbox",
  },
  {
    command: "/code [description]",
    description: "Generate code artifact (no execution)",
  },
] as const;

const PRICING = [
  { usage: "Quick script", duration: "30 seconds", cost: "~$0.002" },
  { usage: "Code + preview", duration: "2 minutes", cost: "~$0.01" },
  { usage: "Full app build", duration: "10 minutes", cost: "~$0.05" },
  { usage: "Free tier", duration: "Up to 45 min, 4 vCPUs", cost: "Included" },
] as const;

const TRY_IT_PROMPTS = [
  "Build a snake game",
  "Create a data dashboard",
  "Write a CSV parser",
  "Generate an API client",
] as const;

export default function SandboxPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Hero */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="h-5 w-5 text-primary" />
          <Badge variant="secondary" className="text-[10px]">
            Beta
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
          Code Sandbox
        </h1>
        <p className="text-muted-foreground text-base max-w-xl">
          Execute code, preview apps, and build tools &mdash; all from chat.
        </p>

        {/* Visual mockup */}
        <div className="mt-6 rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono ml-2">
              sandbox &mdash; artifact panel
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x min-h-[160px]">
            {/* Code side */}
            <div className="p-4 font-mono text-xs text-muted-foreground leading-relaxed">
              <p className="text-primary/80">
                <span className="text-blue-400">const</span> app{" "}
                <span className="text-blue-400">=</span>{" "}
                <span className="text-yellow-400">express</span>();
              </p>
              <p>
                app.<span className="text-yellow-400">get</span>(
                <span className="text-green-400">&apos;/&apos;</span>, (req,
                res) =&gt; {"{"}</p>
              <p className="pl-4">
                res.<span className="text-yellow-400">json</span>({"{"}{" "}
                <span className="text-green-400">status</span>:{" "}
                <span className="text-green-400">&apos;ok&apos;</span> {"}"});
              </p>
              <p>{"}"});</p>
              <p className="mt-2">
                app.<span className="text-yellow-400">listen</span>(
                <span className="text-orange-400">3000</span>);
              </p>
            </div>
            {/* Preview side */}
            <div className="p-4 flex items-center justify-center bg-muted/10">
              <div className="text-center">
                <Cpu className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Live preview renders here
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  React, HTML, or API output
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities grid */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Capabilities</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, description, usage, features }) => (
            <Card key={title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <CardDescription className="text-sm">
                  {description}
                </CardDescription>
                <p className="text-xs text-muted-foreground/80">{usage}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="space-y-0">
          {STEPS.map(({ icon: Icon, step, title, description }, idx) => (
            <div key={step} className="flex gap-4 relative">
              {/* Vertical connector line */}
              {idx < STEPS.length - 1 && (
                <div className="absolute left-[18px] top-10 bottom-0 w-px bg-border" />
              )}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-semibold z-10">
                {step}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Slash Commands */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Slash Commands</h2>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Command
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  What It Does
                </th>
              </tr>
            </thead>
            <tbody>
              {SLASH_COMMANDS.map(({ command, description }) => (
                <tr key={command} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                      {command}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Pricing</h2>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Usage
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {PRICING.map(({ usage, duration, cost }) => (
                <tr key={usage} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{usage}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {duration}
                  </td>
                  <td className="px-4 py-2.5">
                    {cost === "Included" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Included
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{cost}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Try It */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Try It</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click a prompt to open it in chat.
        </p>
        <div className="flex flex-wrap gap-2">
          {TRY_IT_PROMPTS.map((prompt) => (
            <Link
              key={prompt}
              href={`/chat?prompt=${encodeURIComponent(prompt)}`}
              className="group inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {prompt}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
