"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Tag,
  Scale,
  FolderKanban,
  Calendar,
  CheckSquare,
} from "lucide-react";

interface EntityChipsProps {
  entities: {
    people?: string[];
    topics?: string[];
    decisions?: string[];
    action_items?: string[];
    projects?: string[];
    dates?: string[];
  } | null;
}

interface EntityGroupConfig {
  key: keyof NonNullable<EntityChipsProps["entities"]>;
  label: string;
  icon: React.ElementType;
  colorClasses: string;
  clickable: boolean;
}

const ENTITY_GROUPS: EntityGroupConfig[] = [
  {
    key: "people",
    label: "People",
    icon: User,
    colorClasses: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900",
    clickable: true,
  },
  {
    key: "topics",
    label: "Topics",
    icon: Tag,
    colorClasses: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900",
    clickable: true,
  },
  {
    key: "decisions",
    label: "Decisions",
    icon: Scale,
    colorClasses: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900",
    clickable: true,
  },
  {
    key: "projects",
    label: "Projects",
    icon: FolderKanban,
    colorClasses: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900",
    clickable: true,
  },
  {
    key: "dates",
    label: "Dates",
    icon: Calendar,
    colorClasses: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
    clickable: false,
  },
  {
    key: "action_items",
    label: "Action Items",
    icon: CheckSquare,
    colorClasses: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    clickable: false,
  },
];

export function EntityChips({ entities }: EntityChipsProps) {
  const router = useRouter();

  if (!entities) return null;

  const visibleGroups = ENTITY_GROUPS.filter(
    (g) => entities[g.key] && entities[g.key]!.length > 0,
  );

  if (visibleGroups.length === 0) return null;

  function handleChipClick(value: string) {
    router.push(`/context?search=${encodeURIComponent(value)}`);
  }

  return (
    <div data-testid="entity-chips" className="space-y-4">
      {visibleGroups.map((group) => {
        const Icon = group.icon;
        const items = entities[group.key]!;
        return (
          <div key={group.key} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item, i) =>
                group.clickable ? (
                  <button
                    key={i}
                    onClick={() => handleChipClick(item)}
                    data-testid={`entity-chip-${group.key}-${i}`}
                  >
                    <Badge
                      className={`${group.colorClasses} cursor-pointer transition-colors gap-1.5 font-normal`}
                    >
                      <Icon className="h-3 w-3" />
                      {item}
                    </Badge>
                  </button>
                ) : (
                  <Badge
                    key={i}
                    data-testid={`entity-chip-${group.key}-${i}`}
                    className={`${group.colorClasses} font-normal gap-1.5`}
                  >
                    <Icon className="h-3 w-3" />
                    {item}
                  </Badge>
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
