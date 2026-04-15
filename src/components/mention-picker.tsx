"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Code, MessageSquare, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionUser {
  id: string;
  name: string;
  email: string;
}

export interface MentionItem {
  id: string;
  type: string;
  title: string;
}

export interface MentionPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: MentionUser) => void;
  onSelectItem: (item: MentionItem) => void;
  query: string;
  orgId: string;
  position?: { top: number; left: number };
  /** Which tab to show initially. Defaults to "people". */
  defaultTab?: "people" | "library";
}

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

const typeIcons: Record<string, React.ElementType> = {
  doc: FileText,
  document: FileText,
  artifact: Code,
  code: Code,
  conversation: MessageSquare,
  chat: MessageSquare,
};

function ItemIcon({ type }: { type: string }) {
  const Icon = typeIcons[type.toLowerCase()] ?? FileText;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// Avatar placeholder
// ---------------------------------------------------------------------------

function AvatarPlaceholder({ name }: { name: string }) {
  const letter = (name?.[0] ?? "?").toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
      {letter}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MentionPicker
// ---------------------------------------------------------------------------

export function MentionPicker({
  open,
  onClose,
  onSelectUser,
  onSelectItem,
  query,
  orgId,
  position,
  defaultTab = "people",
}: MentionPickerProps) {
  const [activeTab, setActiveTab] = useState<"people" | "library">(defaultTab);
  const [libraryScope, setLibraryScope] = useState<"mine" | "shared">("mine");

  // ---- Data fetching state ----
  const [members, setMembers] = useState<MentionUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [items, setItems] = useState<MentionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // ---- Fetch org members ----
  useEffect(() => {
    if (!open || !orgId) return;

    let cancelled = false;
    setMembersLoading(true);

    fetch(`/api/team/members?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list: MentionUser[] = (data.members ?? data ?? []).map(
            (m: Record<string, string>) => ({
              id: m.id ?? m.user_id,
              name: m.name ?? m.full_name ?? m.email ?? "Unknown",
              email: m.email ?? "",
            })
          );
          setMembers(list);
        }
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  // ---- Fetch library items ----
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setItemsLoading(true);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("scope", libraryScope);
    params.set("orgId", orgId);

    fetch(`/api/context?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list: MentionItem[] = (data.items ?? data ?? []).map(
            (i: Record<string, string>) => ({
              id: i.id,
              type: i.type ?? "document",
              title: i.title ?? i.name ?? "Untitled",
            })
          );
          setItems(list);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, query, libraryScope, orgId]);

  // ---- Filter members by query ----
  const filteredMembers = useMemo(() => {
    if (!query) return members;
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  // ---- Filter library items by query (client-side supplement) ----
  const filteredItems = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.title.toLowerCase().includes(q));
  }, [items, query]);

  // ---- Keyboard: escape to close ----
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // ---- Select handlers ----
  const handleSelectUser = useCallback(
    (user: MentionUser) => {
      onSelectUser(user);
      onClose();
    },
    [onSelectUser, onClose]
  );

  const handleSelectItem = useCallback(
    (item: MentionItem) => {
      onSelectItem(item);
      onClose();
    },
    [onSelectItem, onClose]
  );

  if (!open) return null;

  return (
    <div
      data-testid="mention-picker"
      className={cn(
        "absolute z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
      style={
        position
          ? { top: position.top, left: position.left }
          : undefined
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "people" | "library")}
      >
        <TabsList className="w-full">
          <TabsTrigger value="people" className="flex-1">
            People
          </TabsTrigger>
          <TabsTrigger value="library" className="flex-1">
            Library
          </TabsTrigger>
        </TabsList>

        {/* ---- People tab ---- */}
        <TabsContent value="people" className="mt-0">
          <Command>
            <CommandList>
              {membersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <CommandEmpty>No people found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredMembers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => handleSelectUser(user)}
                    >
                      <AvatarPlaceholder name={user.name} />
                      <div className="ml-2 flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </TabsContent>

        {/* ---- Library tab ---- */}
        <TabsContent value="library" className="mt-0">
          {/* Scope toggle */}
          <div className="flex gap-1 border-b px-2 py-1.5">
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                libraryScope === "mine"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLibraryScope("mine")}
            >
              My Items
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                libraryScope === "shared"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLibraryScope("shared")}
            >
              Shared with me
            </button>
          </div>

          <Command>
            <CommandList>
              {itemsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <CommandEmpty>No items found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.title}
                      onSelect={() => handleSelectItem(item)}
                    >
                      <ItemIcon type={item.type} />
                      <span className="ml-2 truncate text-sm">
                        {item.title}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </TabsContent>
      </Tabs>
    </div>
  );
}
