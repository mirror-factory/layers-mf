"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SKILL_CATEGORIES, type SkillCategory } from "@/lib/skills/types";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_TOOLS = [
  { name: "search_context", label: "Search Context" },
  { name: "get_document", label: "Get Document" },
  { name: "create_document", label: "Create Document" },
  { name: "edit_document", label: "Edit Document" },
  { name: "ask_linear_agent", label: "Linear Agent" },
  { name: "ask_gmail_agent", label: "Gmail Agent" },
  { name: "ask_granola_agent", label: "Granola Agent" },
  { name: "ask_notion_agent", label: "Notion Agent" },
  { name: "ask_drive_agent", label: "Drive Agent" },
  { name: "write_code", label: "Write Code" },
  { name: "run_code", label: "Run Code" },
  { name: "list_approvals", label: "List Approvals" },
  { name: "propose_action", label: "Propose Action" },
];

const EMOJI_OPTIONS = [
  "⚡", "📋", "✉️", "🎙️", "💻", "📊", "🎨", "🔍", "📝", "🤖",
  "🧩", "🛠️", "📦", "🔧", "🚀", "💡", "📈", "🗂️", "🎯", "🔬",
];

const STEPS = [
  { key: "name", label: "Name", question: "What should this skill be called?" },
  {
    key: "description",
    label: "Description",
    question: "Describe what this skill does in one sentence.",
  },
  {
    key: "category",
    label: "Category",
    question: "Pick a category for this skill.",
  },
  {
    key: "icon",
    label: "Icon",
    question: "Choose an emoji icon for this skill.",
  },
  {
    key: "prompt",
    label: "Prompt",
    question:
      "Write the system prompt — this is what Granger becomes when this skill activates.",
  },
  {
    key: "slash",
    label: "Command",
    question: "What slash command should activate it? (e.g., /myskill)",
  },
  {
    key: "tools",
    label: "Tools",
    question: "Which tools should this skill have access to?",
  },
  { key: "review", label: "Review", question: "Review your new skill." },
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SkillCreator({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [category, setCategory] = useState<SkillCategory>("general");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [slashCommand, setSlashCommand] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = useMemo(() => slugify(name), [name]);

  const toggleTool = useCallback((toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  }, []);

  const canAdvance = useMemo(() => {
    switch (STEPS[step].key) {
      case "name":
        return name.trim().length > 0;
      case "description":
        return description.trim().length > 0;
      case "category":
      case "icon":
      case "prompt":
      case "slash":
      case "tools":
      case "review":
        return true;
      default:
        return true;
    }
  }, [step, name, description]);

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim(),
          icon,
          category,
          systemPrompt: systemPrompt.trim() || undefined,
          slashCommand: slashCommand.trim()
            ? slashCommand.trim().startsWith("/")
              ? slashCommand.trim()
              : `/${slashCommand.trim()}`
            : undefined,
          tools: selectedTools.map((t) => ({
            name: t,
            description:
              AVAILABLE_TOOLS.find((at) => at.name === t)?.label ?? t,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create skill");
        return;
      }

      // Reset form
      setName("");
      setDescription("");
      setIcon("⚡");
      setCategory("general");
      setSystemPrompt("");
      setSlashCommand("");
      setSelectedTools([]);
      setStep(0);
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const currentStep = STEPS[step];

  return (
    <div className="max-w-lg">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              // Only allow jumping to completed steps or current
              if (i <= step) setStep(i);
            }}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < step
                ? "bg-primary"
                : i === step
                  ? "bg-primary/60"
                  : "bg-muted"
            )}
            title={s.label}
          />
        ))}
      </div>

      {/* Step label */}
      <p className="text-xs text-muted-foreground mb-1">
        Step {step + 1} of {STEPS.length} — {currentStep.label}
      </p>

      {/* Question */}
      <h3 className="text-sm font-medium mb-4">{currentStep.question}</h3>

      {/* Step content */}
      <div className="min-h-[120px]">
        {currentStep.key === "name" && (
          <div>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Skill"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdvance) goNext();
              }}
            />
            {slug && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                slug: <code>{slug}</code>
              </p>
            )}
          </div>
        )}

        {currentStep.key === "description" && (
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this skill does..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAdvance) goNext();
            }}
          />
        )}

        {currentStep.key === "category" && (
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as SkillCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {currentStep.key === "icon" && (
          <div className="grid grid-cols-10 gap-1.5">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={cn(
                  "text-xl w-10 h-10 rounded-md flex items-center justify-center transition-colors border",
                  icon === emoji
                    ? "bg-primary/10 border-primary"
                    : "border-transparent hover:bg-accent"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {currentStep.key === "prompt" && (
          <div>
            <Textarea
              autoFocus
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a specialist in..."
              rows={5}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Instructions added to Granger&apos;s context when this skill is
              activated. Optional but recommended.
            </p>
          </div>
        )}

        {currentStep.key === "slash" && (
          <div>
            <Input
              autoFocus
              value={slashCommand}
              onChange={(e) => setSlashCommand(e.target.value)}
              placeholder="/myskill"
              onKeyDown={(e) => {
                if (e.key === "Enter") goNext();
              }}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Optional. Users can type this in chat to activate the skill.
            </p>
          </div>
        )}

        {currentStep.key === "tools" && (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TOOLS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleTool(t.name)}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                    selectedTools.includes(t.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {selectedTools.length === 0
                ? "No tools selected — skill will use default tools."
                : `${selectedTools.length} tool${selectedTools.length > 1 ? "s" : ""} selected.`}
            </p>
          </div>
        )}

        {currentStep.key === "review" && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">{icon}</span>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium">{name || "Untitled Skill"}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description || "No description"}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {SKILL_CATEGORIES.find((c) => c.value === category)
                      ?.label ?? category}
                  </span>
                  {slashCommand && (
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                      {slashCommand.startsWith("/")
                        ? slashCommand
                        : `/${slashCommand}`}
                    </code>
                  )}
                </div>
                {systemPrompt && (
                  <div className="mt-3 pt-3 border-t">
                    <Label className="text-[10px] text-muted-foreground">
                      System Prompt
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                      {systemPrompt}
                    </p>
                  </div>
                )}
                {selectedTools.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-[10px] text-muted-foreground">
                      Tools
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {selectedTools.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                        >
                          {AVAILABLE_TOOLS.find((at) => at.name === t)
                            ?.label ?? t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goBack}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            size="sm"
            onClick={goNext}
            disabled={!canAdvance}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !description.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Create Skill
          </Button>
        )}
      </div>
    </div>
  );
}
