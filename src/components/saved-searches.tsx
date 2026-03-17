"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Search, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, string>;
  is_shared: boolean;
  created_at: string;
}

interface SavedSearchesProps {
  /** Current search query in the context library */
  currentQuery?: string;
  /** Current active filters */
  currentFilters?: Record<string, string>;
  /** Called when user clicks a saved search chip */
  onApply: (query: string, filters: Record<string, string>) => void;
}

export function SavedSearches({
  currentQuery,
  currentFilters,
  onApply,
}: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);

  const fetchSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/searches");
      if (res.ok) {
        const data = await res.json();
        setSearches(data.searches ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  async function handleSave() {
    if (!name.trim() || !currentQuery?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          query: currentQuery.trim(),
          filters: currentFilters ?? {},
          is_shared: isShared,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSearches((prev) => [saved, ...prev]);
        setName("");
        setIsShared(false);
        setDialogOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/searches/${id}`, { method: "DELETE" });
  }

  const hasActiveSearch = Boolean(currentQuery?.trim());

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading saved searches...</span>
      </div>
    );
  }

  if (searches.length === 0 && !hasActiveSearch) {
    return null;
  }

  return (
    <div data-testid="saved-searches" className="flex items-center gap-2 flex-wrap">
      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {searches.map((search) => (
        <Badge
          key={search.id}
          data-testid={`saved-search-${search.id}`}
          variant="secondary"
          className="gap-1 text-xs font-normal cursor-pointer hover:bg-accent group"
          onClick={() => onApply(search.query, search.filters)}
        >
          {search.name}
          {search.is_shared && (
            <span className="text-muted-foreground ml-0.5">(shared)</span>
          )}
          <button
            data-testid={`saved-search-delete-${search.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(search.id);
            }}
            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
            aria-label={`Delete saved search ${search.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {hasActiveSearch && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="save-search-button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Save search
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Save Search</DialogTitle>
              <DialogDescription>
                Save &ldquo;{currentQuery}&rdquo; as a quick-access search.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label htmlFor="search-name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="search-name"
                  data-testid="save-search-name-input"
                  placeholder="e.g. Pricing decisions"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="search-shared"
                  data-testid="save-search-shared-checkbox"
                  checked={isShared}
                  onCheckedChange={(checked) =>
                    setIsShared(checked === true)
                  }
                />
                <label htmlFor="search-shared" className="text-sm">
                  Share with team
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                data-testid="save-search-confirm"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
