"use client";

import { useState } from "react";
import { Loader2, Check, FileText, Clock, Plug } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORG_TEMPLATES, type OrgTemplate } from "@/lib/scaffolding/templates";

interface TemplateSelectorProps {
  onApplied?: (templateId: string) => void;
  onSkip?: () => void;
}

type ApplyState = "idle" | "applying" | "done" | "error";

export function TemplateSelector({ onApplied, onSkip }: TemplateSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [result, setResult] = useState<{
    docsCreated: number;
    schedulesCreated: number;
    errors: string[];
  } | null>(null);

  const selectedTemplate = ORG_TEMPLATES.find((t) => t.id === selected);

  async function handleApply() {
    if (!selected) return;

    setApplyState("applying");
    try {
      const res = await fetch("/api/scaffolding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected }),
      });
      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setApplyState("error");
        setResult({ docsCreated: 0, schedulesCreated: 0, errors: [data.error] });
        return;
      }

      setResult({
        docsCreated: data.docsCreated ?? 0,
        schedulesCreated: data.schedulesCreated ?? 0,
        errors: data.errors ?? [],
      });
      setApplyState("done");
      onApplied?.(selected);
    } catch {
      setApplyState("error");
      setResult({ docsCreated: 0, schedulesCreated: 0, errors: ["Network error"] });
    }
  }

  if (applyState === "done" && result) {
    return (
      <Card>
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Template applied!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace has been configured with the{" "}
              <span className="font-medium text-foreground">{selectedTemplate?.name}</span>{" "}
              template.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {result.docsCreated > 0 && (
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{result.docsCreated} priority document{result.docsCreated !== 1 ? "s" : ""} created</span>
            </div>
          )}
          {result.schedulesCreated > 0 && (
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{result.schedulesCreated} schedule{result.schedulesCreated !== 1 ? "s" : ""} created</span>
            </div>
          )}
          {selectedTemplate && selectedTemplate.suggestedIntegrations.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Plug className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Suggested integrations: {selectedTemplate.suggestedIntegrations.join(", ")}</span>
            </div>
          )}
          {result.errors.length > 0 && (
            <p className="text-xs text-destructive">
              Some items had errors: {result.errors.join("; ")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Choose a template</h2>
        <p className="text-sm text-muted-foreground">
          Start with pre-configured docs, schedules, and permissions.
        </p>
      </div>

      <div className="grid gap-3">
        {ORG_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selected === template.id}
            onSelect={() => setSelected(template.id)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {onSkip && (
          <Button variant="outline" className="flex-1" onClick={onSkip}>
            Skip
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!selected || applyState === "applying"}
          onClick={handleApply}
        >
          {applyState === "applying" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            "Apply Template"
          )}
        </Button>
      </div>

      {applyState === "error" && result && (
        <p className="text-xs text-center text-destructive">
          {result.errors[0] ?? "Failed to apply template. Try again."}
        </p>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: OrgTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:bg-accent/50",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{template.icon}</span>
          <span className="font-medium">{template.name}</span>
        </div>
        {isSelected && (
          <span className="text-xs text-primary font-medium">Selected</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{template.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {template.priorityDocs.length} doc{template.priorityDocs.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {template.defaultSchedules.length} schedule{template.defaultSchedules.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Plug className="h-3 w-3" />
          {template.suggestedIntegrations.length} integration{template.suggestedIntegrations.length !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
