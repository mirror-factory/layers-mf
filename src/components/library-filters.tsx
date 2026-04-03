"use client";

import { useMemo } from "react";
import { Filter, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContextItem {
  id: string;
  title: string;
  description_short: string | null;
  source_type: string;
  content_type: string;
  status: string;
  ingested_at: string;
  user_tags?: string[] | null;
}

interface LibraryFiltersProps {
  items: ContextItem[];
  allTags: string[];
  typeFilter: string;
  tagsFilter: string;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
  activeCount: number;
  onTypeChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearAll: () => void;
}

export function LibraryFilters({
  items,
  allTags,
  typeFilter,
  tagsFilter,
  statusFilter,
  dateFrom,
  dateTo,
  activeCount,
  onTypeChange,
  onTagsChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: LibraryFiltersProps) {
  const contentTypes = useMemo(
    () => [...new Set(items.map((i) => i.content_type))].sort(),
    [items],
  );

  const statuses = useMemo(
    () => [...new Set(items.map((i) => i.status))].sort(),
    [items],
  );

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeCount > 0 && (
              <Badge
                variant="default"
                className="h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Filters</h4>
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Content Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Content Type
              </label>
              <Select value={typeFilter || "all"} onValueChange={(v) => onTypeChange(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {contentTypes.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {ct.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tags</label>
              <div className="flex flex-wrap gap-1">
                {allTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tags yet</p>
                ) : (
                  allTags.map((tag) => {
                    const isActive = tagsFilter
                      .split(",")
                      .map((t) => t.trim())
                      .includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          const current = tagsFilter
                            ? tagsFilter.split(",").map((t) => t.trim())
                            : [];
                          if (isActive) {
                            onTagsChange(
                              current.filter((t) => t !== tag).join(","),
                            );
                          } else {
                            onTagsChange([...current, tag].join(","));
                          }
                        }}
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors border",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-transparent hover:bg-accent",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter pills */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {typeFilter && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal h-6">
              {typeFilter.replace(/_/g, " ")}
              <button
                onClick={() => onTypeChange("")}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal h-6">
              {statusFilter}
              <button
                onClick={() => onStatusChange("")}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {tagsFilter && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal h-6">
              tags: {tagsFilter}
              <button
                onClick={() => onTagsChange("")}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(dateFrom || dateTo) && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal h-6">
              {dateFrom || "..."} - {dateTo || "..."}
              <button
                onClick={() => {
                  onDateFromChange("");
                  onDateToChange("");
                }}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <button
            onClick={onClearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
