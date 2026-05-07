"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface TagManagerProps {
  tags: string[];
  allTags?: string[];
  onChange: (tags: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

export function TagManager({
  tags,
  allTags = [],
  onChange,
  readOnly = false,
  className,
}: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions: existing tags not already applied
  const suggestions = allTags.filter(
    (t) =>
      !tags.includes(t) &&
      t.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInputValue("");
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && inputValue.trim()) {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [inputValue, tags, addTag, removeTag],
  );

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (readOnly) {
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {tags.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tags</span>
        ) : (
          tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs font-normal"
            >
              {tag}
            </Badge>
          ))
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Current tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 text-xs font-normal pr-1"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add tag button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-xs px-2 border-dashed"
            >
              <Plus className="h-3 w-3" />
              Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type to add or search..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {suggestions.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        addTag(tag);
                      }}
                      className="flex items-center w-full px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-left"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new if no match */}
              {inputValue.trim() &&
                !suggestions.includes(inputValue.trim().toLowerCase()) &&
                !tags.includes(inputValue.trim().toLowerCase()) && (
                  <button
                    onClick={() => addTag(inputValue)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    Create &ldquo;{inputValue.trim()}&rdquo;
                  </button>
                )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
