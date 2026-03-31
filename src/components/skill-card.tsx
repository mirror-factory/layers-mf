"use client";

import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SkillRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string | null;
  category: string;
  icon: string;
  slash_command: string | null;
  is_active: boolean;
  is_builtin: boolean;
};

const CATEGORY_COLORS: Record<string, string> = {
  productivity: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  analysis: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  creative: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  development: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  communication: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  general: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
};

export function SkillCard({
  skill,
  onToggle,
  onDelete,
}: {
  skill: SkillRow;
  onToggle: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        !skill.is_active && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl shrink-0" role="img" aria-label={skill.name}>
            {skill.icon}
          </span>
          <div className="min-w-0">
            <h3 className="font-medium text-sm leading-tight">{skill.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {skill.description}
            </p>
          </div>
        </div>
        <Switch
          checked={skill.is_active}
          onCheckedChange={(checked) => onToggle(skill.id, checked)}
          aria-label={`Toggle ${skill.name}`}
        />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] px-1.5 py-0 border-0",
            CATEGORY_COLORS[skill.category] ?? CATEGORY_COLORS.general
          )}
        >
          {skill.category}
        </Badge>
        {skill.slash_command && (
          <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
            {skill.slash_command}
          </code>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          v{skill.version}
        </span>
      </div>

      {!skill.is_builtin && onDelete && (
        <div className="flex justify-end mt-2 pt-2 border-t">
          <button
            onClick={() => onDelete(skill.id)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
