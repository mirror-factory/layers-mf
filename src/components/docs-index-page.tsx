"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Layers,
  Library,
  Share2,
  Building2,
  Plug,
  Bell,
  Monitor,
  Database,
  Archive,
  FileText,
  Search,
  ArrowRight,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import type { DocNode, DocCategory } from "@/lib/docs-shared";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Layers,
  Library,
  Share2,
  Building2,
  Plug,
  Bell,
  Monitor,
  Database,
  Archive,
  FileText,
};

/* ─── Sidebar tree (shared with docs-page) ─── */

function TreeNode({
  node,
  depth = 0,
  searchActive,
  onNavigate,
}: {
  node: DocNode;
  depth?: number;
  searchActive?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(() => {
    if (searchActive) return true;
    const docPath = node.slug ? `/docs/${node.slug}` : "/docs";
    return pathname.startsWith(docPath);
  });

  useEffect(() => {
    if (searchActive) setExpanded(true);
  }, [searchActive]);

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
            "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate font-medium">{node.name}</span>
          {node.docCount != null && (
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">
              {node.docCount}
            </span>
          )}
        </button>
        {expanded && node.children && (
          <div className="relative">
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-border/50"
              style={{ marginLeft: `${depth * 16 + 18}px` }}
            />
            {node.children.map((child) => (
              <TreeNode
                key={child.slug || child.name}
                node={child}
                depth={depth + 1}
                searchActive={searchActive}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const href = node.slug ? `/docs/${node.slug}` : "/docs";
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </Link>
  );
}

function filterTree(nodes: DocNode[], query: string): DocNode[] {
  const lower = query.toLowerCase();
  const filtered: DocNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      const filteredChildren = filterTree(node.children ?? [], query);
      if (filteredChildren.length > 0) {
        filtered.push({ ...node, children: filteredChildren });
      }
    } else {
      if (node.name.toLowerCase().includes(lower)) {
        filtered.push(node);
      }
    }
  }
  return filtered;
}

/* ─── Category card ─── */

function CategoryCard({ category }: { category: DocCategory }) {
  const IconComponent = ICON_MAP[category.icon] ?? FileText;

  return (
    <Link
      href={`/docs/${category.firstDocSlug}`}
      className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:bg-accent/30 hover:shadow-md hover:shadow-primary/5"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <IconComponent className="h-4.5 w-4.5" />
        </div>
        <Badge variant="secondary" className="text-[11px] font-normal">
          {category.docCount} {category.docCount === 1 ? "doc" : "docs"}
        </Badge>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">
          {category.name}
        </h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
          {category.description}
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
        Browse docs
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

/* ─── Main index page ─── */

export function DocsIndexPage({
  tree,
  categories,
  totalDocs,
  overviewContent,
  overviewTitle,
  lastModified,
}: {
  tree: DocNode[];
  categories: DocCategory[];
  totalDocs: number;
  overviewContent?: string;
  overviewTitle: string;
  lastModified?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    return filterTree(tree, searchQuery.trim());
  }, [tree, searchQuery]);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        aria-label="Open doc navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r bg-card/95 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0 md:z-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Link href="/docs" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">Docs</h2>
          </Link>
          <button
            onClick={closeSidebar}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 py-2.5 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              ref={searchInputRef}
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-[13px] bg-muted/50 border-0 focus-visible:ring-1"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground/60">
                <span className="text-xs">&#8984;</span>K
              </kbd>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-0.5 p-2">
            {filteredTree.length > 0 ? (
              filteredTree.map((node) => (
                <TreeNode
                  key={node.slug || node.name}
                  node={node}
                  searchActive={!!searchQuery.trim()}
                  onNavigate={closeSidebar}
                />
              ))
            ) : (
              <div className="px-3 py-8 text-center">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No docs match &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </nav>
        </ScrollArea>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Documentation
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalDocs} documents across {categories.length} categories
                  {lastModified && (
                    <span className="text-muted-foreground/50">
                      {" "}
                      &middot; Updated{" "}
                      {new Date(lastModified).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Category grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>

          {/* Quick links */}
          <div className="mt-12 rounded-xl border bg-card/50 p-6">
            <h2 className="text-sm font-semibold mb-4">Quick Start</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/docs/roadmap"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary/60" />
                <span>Roadmap</span>
                <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />
              </Link>
              <Link
                href="/docs/registries/db-schema-reference"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Database className="h-4 w-4 shrink-0 text-primary/60" />
                <span>DB Schema Reference</span>
              </Link>
              <Link
                href="/docs/registries/api-reference"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Monitor className="h-4 w-4 shrink-0 text-primary/60" />
                <span>API Reference</span>
              </Link>
              <Link
                href="/docs/registries/tool-registry"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Plug className="h-4 w-4 shrink-0 text-primary/60" />
                <span>Tool Registry</span>
              </Link>
              <Link
                href="/docs/platform/brand-guide"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Layers className="h-4 w-4 shrink-0 text-primary/60" />
                <span>Brand Guide</span>
              </Link>
              <Link
                href="/docs/chat/context-engineering"
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-primary/60" />
                <span>Context Engineering</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
