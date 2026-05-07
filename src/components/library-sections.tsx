"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Code,
  MessageSquare,
  Globe,
  Search,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */

export interface LibrarySectionItem {
  id: string;
  title: string;
  source_type: string;
  content_type?: string;
  updated_at?: string;
  ingested_at?: string;
  user_tags?: string[] | null;
  shared_by?: string | null;
  permission?: string | null;
}

export interface LibrarySectionsProps {
  onItemClick?: (itemId: string) => void;
}

type SectionTab = "my-items" | "shared" | "org";
type SourceFilter = "all" | "document" | "artifact" | "conversation";

/* ---------- Constants ---------- */

const SOURCE_TYPE_ICON: Record<string, React.ElementType> = {
  document: FileText,
  doc: FileText,
  artifact: Code,
  code: Code,
  conversation: MessageSquare,
  message: MessageSquare,
  web: Globe,
  url: Globe,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  doc: "Document",
  artifact: "Artifact",
  code: "Artifact",
  conversation: "Conversation",
  message: "Conversation",
  web: "Web",
  url: "Web",
};

function getSourceIcon(sourceType: string): React.ElementType {
  return SOURCE_TYPE_ICON[sourceType] ?? FileText;
}

function getSourceLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
}

function relativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ---------- Section config ---------- */

const SECTION_CONFIG: Record<SectionTab, { label: string; fetchUrl: string }> = {
  "my-items": {
    label: "My Items",
    fetchUrl: "/api/context?owner=me",
  },
  shared: {
    label: "Shared with Me",
    fetchUrl: "/api/sharing?direction=received",
  },
  org: {
    label: "Org Library",
    fetchUrl: "/api/context?scope=org",
  },
};

/* ---------- ItemRow ---------- */

function ItemRow({
  item,
  onClick,
}: {
  item: LibrarySectionItem;
  onClick?: () => void;
}) {
  const Icon = getSourceIcon(item.source_type);
  const dateStr = item.updated_at ?? item.ingested_at;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-colors hover:bg-accent hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="library-item-row"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {getSourceLabel(item.source_type)}
          </Badge>
          {dateStr && (
            <span className="text-xs text-muted-foreground">
              {relativeDate(dateStr)}
            </span>
          )}
        </div>
      </div>
      {item.user_tags && item.user_tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1">
          {item.user_tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {item.user_tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{item.user_tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/* ---------- Loading skeleton ---------- */

function ItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/* ---------- SectionContent ---------- */

function SectionContent({
  tab,
  search,
  sourceFilter,
  onItemClick,
}: {
  tab: SectionTab;
  search: string;
  sourceFilter: SourceFilter;
  onItemClick?: (itemId: string) => void;
}) {
  const [items, setItems] = useState<LibrarySectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SECTION_CONFIG[tab].fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      // API may return { items: [...] } or [...] directly
      const list = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    let result = items;

    // Filter by source_type
    if (sourceFilter !== "all") {
      result = result.filter((item) => {
        const label = getSourceLabel(item.source_type).toLowerCase();
        return label === sourceFilter;
      });
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.source_type.toLowerCase().includes(q) ||
          (item.user_tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, sourceFilter, search]);

  if (loading) {
    return (
      <div className="space-y-1" data-testid="section-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <ItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={fetchItems}
          className="mt-2 text-sm text-primary underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
        <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          {search.trim() || sourceFilter !== "all"
            ? "No items match your filters"
            : "No items yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y" data-testid="section-items">
      {filtered.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onClick={() => onItemClick?.(item.id)}
        />
      ))}
    </div>
  );
}

/* ---------- LibrarySections ---------- */

export function LibrarySections({ onItemClick }: LibrarySectionsProps) {
  const [activeTab, setActiveTab] = useState<SectionTab>("my-items");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="library-search"
          />
        </div>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as SourceFilter)}
        >
          <SelectTrigger className="w-[160px]" data-testid="type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="artifact">Artifacts</SelectItem>
            <SelectItem value="conversation">Conversations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as SectionTab);
          setSearch("");
        }}
      >
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="my-items" data-testid="tab-my-items">
            My Items
          </TabsTrigger>
          <TabsTrigger value="shared" data-testid="tab-shared">
            Shared with Me
          </TabsTrigger>
          <TabsTrigger value="org" data-testid="tab-org">
            Org Library
          </TabsTrigger>
        </TabsList>

        {/* Render each tab's content individually so Radix hides inactive ones */}
        {(["my-items", "shared", "org"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {activeTab === tab && (
              <SectionContent
                tab={tab}
                search={search}
                sourceFilter={sourceFilter}
                onItemClick={onItemClick}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
