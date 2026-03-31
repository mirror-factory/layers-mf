"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CostsExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span>How AI Costs Work</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground space-y-3 border-t pt-3">
          <div>
            <h4 className="font-medium text-foreground mb-1">AI Gateway Costs</h4>
            <p>
              Every chat message, tool call, and agent step uses AI tokens routed through
              the AI Gateway. Token usage is the primary cost driver.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Per-Model Pricing</h4>
            <p>
              Costs vary by model. Haiku is the cheapest and fastest for simple tasks.
              Sonnet balances quality and cost. Opus is the most capable and most expensive,
              best for complex reasoning.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Per-User Tracking</h4>
            <p>
              Usage is tracked per user so you can see who is consuming what. This helps
              identify high-usage patterns and optimize model selection.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Sandbox Compute</h4>
            <p>
              Code execution sandboxes incur separate costs for CPU time, memory allocation,
              and network egress. These appear in the Sandbox Compute section below.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Credit Balance</h4>
            <p>
              Prepaid credits are deducted per request based on token usage and model pricing.
              Monitor your balance from the sidebar or the Billing page.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Getting Started</h4>
            <p>
              Data appears here as you use Granger. New installs start at $0 with no
              charges until you begin sending messages and running tools.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
