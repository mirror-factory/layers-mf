"use client";

import { useState, useCallback } from "react";
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
import { Loader2 } from "lucide-react";

const AVAILABLE_TOOLS = [
  { name: "search_context", label: "Search Context" },
  { name: "get_document", label: "Get Document" },
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [category, setCategory] = useState<SkillCategory>("general");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [slashCommand, setSlashCommand] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugify(name);

  const toggleTool = useCallback((toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Name + Icon */}
      <div className="flex gap-3">
        <div className="shrink-0">
          <Label className="text-xs mb-1.5 block">Icon</Label>
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger className="w-16 text-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="grid grid-cols-5 gap-1 p-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <SelectItem
                    key={emoji}
                    value={emoji}
                    className="text-xl justify-center px-2"
                  >
                    {emoji}
                  </SelectItem>
                ))}
              </div>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="skill-name" className="text-xs mb-1.5 block">
            Name
          </Label>
          <Input
            id="skill-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Skill"
            required
          />
          {slug && (
            <p className="text-[10px] text-muted-foreground mt-1">
              slug: <code>{slug}</code>
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="skill-desc" className="text-xs mb-1.5 block">
          Description
        </Label>
        <Input
          id="skill-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this skill does..."
          required
        />
      </div>

      {/* Category */}
      <div>
        <Label className="text-xs mb-1.5 block">Category</Label>
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
      </div>

      {/* Slash Command */}
      <div>
        <Label htmlFor="skill-slash" className="text-xs mb-1.5 block">
          Slash Command (optional)
        </Label>
        <Input
          id="skill-slash"
          value={slashCommand}
          onChange={(e) => setSlashCommand(e.target.value)}
          placeholder="/myskill"
        />
      </div>

      {/* System Prompt */}
      <div>
        <Label htmlFor="skill-prompt" className="text-xs mb-1.5 block">
          System Prompt
        </Label>
        <Textarea
          id="skill-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a specialist in..."
          rows={4}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Instructions added to Granger&apos;s context when this skill is
          activated.
        </p>
      </div>

      {/* Tools */}
      <div>
        <Label className="text-xs mb-1.5 block">Tools</Label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TOOLS.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => toggleTool(t.name)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                selectedTools.includes(t.name)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={saving || !name.trim() || !description.trim()}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Create Skill
      </Button>
    </form>
  );
}
