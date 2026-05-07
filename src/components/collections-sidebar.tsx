"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Folder,
  FolderPlus,
  Pin,
  Clock,
  Archive,
  Tag,
  Sparkles,
  ChevronRight,
  Plus,
  MoreHorizontal,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ---------- Types ---------- */
export interface Collection {
  id: string;
  name: string;
  icon?: string;
  parent_id?: string | null;
  item_count: number;
  children?: Collection[];
}

export interface TagItem {
  name: string;
  count: number;
}

export type SidebarSection =
  | "all"
  | "pinned"
  | "recent"
  | "archived"
  | { type: "collection"; id: string }
  | { type: "tag"; name: string }
  | { type: "smart"; id: string };

interface Props {
  active: SidebarSection;
  onSelect: (section: SidebarSection) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

const SYSTEM_SECTIONS: { key: SidebarSection; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Items", icon: FolderOpen },
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "recent", label: "Recently Viewed", icon: Clock },
  { key: "archived", label: "Archived", icon: Archive },
];

const SMART_COLLECTIONS = [
  { id: "needs-review", name: "Needs Review", filter: "status:pending" },
  { id: "this-week", name: "Added This Week", filter: "date:7d" },
  { id: "untagged", name: "Untagged", filter: "tags:none" },
];

function sectionEquals(a: SidebarSection, b: SidebarSection): boolean {
  if (typeof a === "string" && typeof b === "string") return a === b;
  if (typeof a === "object" && typeof b === "object") {
    if (a.type !== b.type) return false;
    if (a.type === "collection" && b.type === "collection") return a.id === b.id;
    if (a.type === "tag" && b.type === "tag") return a.name === b.name;
    if (a.type === "smart" && b.type === "smart") return a.id === b.id;
  }
  return false;
}

/* ---------- Collection Tree Node ---------- */
function CollectionNode({
  collection,
  depth,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  collection: Collection;
  depth: number;
  active: SidebarSection;
  onSelect: (section: SidebarSection) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = collection.children && collection.children.length > 0;
  const isActive = typeof active === "object" && active.type === "collection" && active.id === collection.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect({ type: "collection", id: collection.id })}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0 p-0.5 rounded hover:bg-accent"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-xs">{collection.name}</span>
        <span className="text-[10px] opacity-60 shrink-0">{collection.item_count}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-accent transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => {
              const newName = prompt("Rename collection:", collection.name);
              if (newName && newName.trim()) onRename(collection.id, newName.trim());
            }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(collection.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && hasChildren && (
        <div>
          {collection.children!.map((child) => (
            <CollectionNode
              key={child.id}
              collection={child}
              depth={depth + 1}
              active={active}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Main Sidebar ---------- */
export function CollectionsSidebar({ active, onSelect, collapsed = false, onCollapsedChange, className }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [smartExpanded, setSmartExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(buildTree(data.collections ?? data ?? []));
      }
    } catch { /* silent */ }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? data ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchCollections(); fetchTags(); }, [fetchCollections, fetchTags]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    try {
      await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewName("");
      setCreating(false);
      fetchCollections();
    } catch { /* silent */ }
  }

  async function handleRename(id: string, name: string) {
    try {
      await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      fetchCollections();
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      fetchCollections();
      if (typeof active === "object" && active.type === "collection" && active.id === id) {
        onSelect("all");
      }
    } catch { /* silent */ }
  }

  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center py-2 gap-1 border-r bg-card/50", className)}>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCollapsedChange?.(false)}>
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col w-[240px] border-r bg-card/50 shrink-0", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Library</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCollapsedChange?.(true)}>
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-4">
          {/* System sections */}
          <div className="space-y-0.5 px-2">
            {SYSTEM_SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={typeof key === "string" ? key : "obj"}
                onClick={() => onSelect(key)}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
                  sectionEquals(active, key)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left truncate">{label}</span>
              </button>
            ))}
          </div>

          {/* Collections */}
          <div>
            <div className="flex items-center justify-between px-4 mb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collections</span>
              <button
                onClick={() => setCreating(true)}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-2 space-y-0.5">
              {creating && (
                <div className="flex items-center gap-1 px-2 py-1">
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    onBlur={handleCreate}
                    placeholder="Collection name..."
                    className="flex-1 bg-transparent text-xs border-b border-primary/30 outline-none py-0.5 placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => { setCreating(false); setNewName(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {collections.length === 0 && !creating && (
                <p className="text-[11px] text-muted-foreground/60 px-2 py-1">No collections yet</p>
              )}
              {collections.map((col) => (
                <CollectionNode
                  key={col.id}
                  collection={col}
                  depth={0}
                  active={active}
                  onSelect={onSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>

          {/* Smart Collections */}
          <div>
            <button
              onClick={() => setSmartExpanded(!smartExpanded)}
              className="flex items-center gap-1.5 px-4 mb-1 w-full"
            >
              <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", smartExpanded && "rotate-90")} />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Smart Collections</span>
            </button>
            {smartExpanded && (
              <div className="px-2 space-y-0.5">
                {SMART_COLLECTIONS.map((sc) => {
                  const isActive = typeof active === "object" && active.type === "smart" && active.id === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => onSelect({ type: "smart", id: sc.id })}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-left truncate">{sc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <button
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="flex items-center gap-1.5 px-4 mb-1 w-full"
            >
              <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", tagsExpanded && "rotate-90")} />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</span>
            </button>
            {tagsExpanded && (
              <div className="px-3 flex flex-wrap gap-1">
                {tags.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 py-1">No tags yet</p>
                )}
                {tags.map((tag) => {
                  const isActive = typeof active === "object" && active.type === "tag" && active.name === tag.name;
                  return (
                    <button
                      key={tag.name}
                      onClick={() => onSelect({ type: "tag", name: tag.name })}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors border",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/30 font-medium"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag.name}
                      <span className="opacity-60">{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------- Helpers ---------- */
function buildTree(flat: Collection[]): Collection[] {
  const map = new Map<string, Collection>();
  const roots: Collection[] = [];

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of flat) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
