"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search } from "lucide-react";

type ContextItem = {
  id: string;
  title: string;
  source_type: string;
  content_type: string;
  description_short: string | null;
};

export function AddContextPicker({
  items,
  onAdd,
}: {
  items: ContextItem[];
  onAdd: (item: ContextItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          (item.description_short?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : items;

  function handleAdd(item: ContextItem) {
    onAdd(item);
    // Don't close — let user add multiple
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Context Items</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {items.length === 0
                ? "All context items are already linked."
                : "No matching items."}
            </p>
          ) : (
            filtered.slice(0, 50).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 px-1 group"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.source_type} · {item.content_type.replace(/_/g, " ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => handleAdd(item)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
