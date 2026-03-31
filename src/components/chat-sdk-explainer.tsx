"use client";

import {
  MessageSquare,
  ArrowRight,
  Bot,
  Zap,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";

interface FeatureRow {
  feature: string;
  discord: "full" | "partial" | "none";
  slack: "full" | "partial" | "none";
  webhook: "full" | "partial" | "none";
}

const FEATURES: FeatureRow[] = [
  { feature: "Natural language chat", discord: "full", slack: "full", webhook: "full" },
  { feature: "Context search & lookup", discord: "full", slack: "full", webhook: "full" },
  { feature: "Tool calling (Linear, Gmail, etc.)", discord: "full", slack: "full", webhook: "full" },
  { feature: "Slash commands (/ask, /status)", discord: "full", slack: "full", webhook: "none" },
  { feature: "Multi-turn threads", discord: "full", slack: "full", webhook: "partial" },
  { feature: "Approval reactions", discord: "full", slack: "partial", webhook: "none" },
  { feature: "Rich formatting (markdown)", discord: "full", slack: "partial", webhook: "full" },
  { feature: "Document artifacts", discord: "none", slack: "none", webhook: "partial" },
  { feature: "Code sandbox execution", discord: "none", slack: "none", webhook: "partial" },
];

function SupportIcon({ level }: { level: "full" | "partial" | "none" }) {
  switch (level) {
    case "full":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "partial":
      return <MinusCircle className="h-4 w-4 text-amber-500" />;
    case "none":
      return <XCircle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

export function ChatSdkExplainer() {
  return (
    <div className="space-y-6">
      {/* What it enables */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="font-medium text-sm">What does this enable?</p>
        <p className="text-muted-foreground text-sm">
          Connect Granger to external platforms so your team gets the full AI
          chief-of-staff experience without leaving Discord, Slack, or any
          webhook-compatible tool.
        </p>

        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <div className="flex items-start gap-2">
            <Search className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Context Search</p>
              <p className="text-xs text-muted-foreground">
                Search your knowledge base from any platform
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Tool Calling</p>
              <p className="text-xs text-muted-foreground">
                Linear, Gmail, Notion, Drive, and more
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Full Agent Loop</p>
              <p className="text-xs text-muted-foreground">
                Multi-step reasoning with approval workflow
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Message flow */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="font-medium text-sm">How messages flow</p>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 font-medium">
            <MessageSquare className="h-3.5 w-3.5" />
            External Platform
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2.5 py-1.5 font-medium">
            Webhook Endpoint
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2.5 py-1.5 font-medium">
            <Bot className="h-3.5 w-3.5" />
            Granger Agent
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 font-medium">
            Response
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Messages arrive via webhook, are authenticated, processed by the same
          agent that powers the web chat (with all tools and context), and the
          response is sent back to the originating platform.
        </p>
      </div>

      {/* Feature support matrix */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="font-medium text-sm">Feature support by platform</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Feature</th>
                <th className="pb-2 px-4 font-medium text-muted-foreground text-center">Discord</th>
                <th className="pb-2 px-4 font-medium text-muted-foreground text-center">Slack</th>
                <th className="pb-2 pl-4 font-medium text-muted-foreground text-center">Webhook</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FEATURES.map((row) => (
                <tr key={row.feature}>
                  <td className="py-2 pr-4 text-xs">{row.feature}</td>
                  <td className="py-2 px-4 text-center">
                    <span className="inline-flex justify-center">
                      <SupportIcon level={row.discord} />
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className="inline-flex justify-center">
                      <SupportIcon level={row.slack} />
                    </span>
                  </td>
                  <td className="py-2 pl-4 text-center">
                    <span className="inline-flex justify-center">
                      <SupportIcon level={row.webhook} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 text-[11px] text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Full support
          </span>
          <span className="inline-flex items-center gap-1">
            <MinusCircle className="h-3 w-3 text-amber-500" /> Partial
          </span>
          <span className="inline-flex items-center gap-1">
            <XCircle className="h-3 w-3 text-muted-foreground/40" /> Not available
          </span>
        </div>
      </div>
    </div>
  );
}
