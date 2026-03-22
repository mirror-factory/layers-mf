"use client";

import { useRouter } from "next/navigation";
import {
  Phone,
  IterationCw,
  ClipboardCheck,
  GraduationCap,
  Newspaper,
  FileSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentTemplate } from "@/lib/agents/templates";
import { AGENT_TEMPLATES } from "@/lib/agents/templates";

const ICON_MAP: Record<string, React.ElementType> = {
  Phone,
  IterationCw,
  ClipboardCheck,
  GraduationCap,
  Newspaper,
  FileSearch,
};

function AgentCard({ template }: { template: AgentTemplate }) {
  const router = useRouter();
  const Icon = ICON_MAP[template.icon] ?? FileSearch;

  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{template.name}</h3>
          {template.outputFormat && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {template.outputFormat.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-1">
        {template.suggestedQueries.map((q) => (
          <span
            key={q}
            className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {q}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => router.push(`/chat?template=${template.id}`)}
        >
          Use in Chat
        </Button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Agents</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Purpose-built agents for common workflows. Select one to start a
          specialized chat session.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TEMPLATES.map((template) => (
          <AgentCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
