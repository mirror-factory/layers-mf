"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding-shell";
import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "google-drive", name: "Google Drive", description: "Docs, Sheets, Slides, PDFs", icon: "📁", available: true },
  { id: "linear", name: "Linear", description: "Import issues and projects", icon: "◆", available: true },
  { id: "slack", name: "Slack", description: "Link channels and threads", icon: "💬", available: true },
  { id: "github", name: "GitHub", description: "Track repos and PRs", icon: "⚙️", available: true },
  { id: "granola", name: "Granola", description: "Meeting transcripts", icon: "🎙️", available: true },
  { id: "discord", name: "Discord", description: "Server messages and channels", icon: "🎮", available: true },
  { id: "google-calendar", name: "Google Calendar", description: "Sync meetings and events", icon: "📅", available: false },
  { id: "notion", name: "Notion", description: "Connect docs and wikis", icon: "📝", available: false },
] as const;

export default function ConnectToolsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, available: boolean) {
    if (!available) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <OnboardingShell currentStep="connect-tools">
      <Card>
        <CardHeader className="text-center pb-2">
          <h1 className="text-2xl font-semibold tracking-tight">Connect your tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the tools you use. You can always add more later from Settings.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => toggle(tool.id, tool.available)}
                disabled={!tool.available}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  tool.available && "hover:bg-accent/50 cursor-pointer",
                  !tool.available && "opacity-60 cursor-not-allowed",
                  selected.has(tool.id) && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-lg">{tool.icon}</span>
                  {!tool.available && (
                    <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">Coming Soon</span>
                  )}
                  {tool.available && selected.has(tool.id) && (
                    <span className="text-xs text-primary font-medium">Selected</span>
                  )}
                </div>
                <p className="text-sm font-medium">{tool.name}</p>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/onboarding/first-session")}
          >
            Skip for now
          </Button>
          <Button
            className="flex-1"
            onClick={() => router.push("/onboarding/first-session")}
          >
            Continue{selected.size > 0 && ` (${selected.size})`}
          </Button>
        </CardFooter>
      </Card>
    </OnboardingShell>
  );
}
