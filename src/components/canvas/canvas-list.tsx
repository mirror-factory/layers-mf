"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PanelTop, Plus, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface CanvasSummary {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  updatedAt: string;
}

export function CanvasList({ canvases }: { canvases: CanvasSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to create canvas");
      const canvas = await res.json();
      setOpen(false);
      setName("");
      setDescription("");
      router.push(`/canvas/${canvas.id}`);
    } catch {
      // Could add toast here
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Canvas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Canvas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="canvas-name">Name</Label>
                <Input
                  id="canvas-name"
                  placeholder="e.g. Q1 Strategy Board"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canvas-desc">Description (optional)</Label>
                <Textarea
                  id="canvas-desc"
                  placeholder="What is this canvas about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!name.trim() || creating}
              >
                {creating && <Loader className="h-4 w-4 mr-1.5 animate-spin" />}
                Create Canvas
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <PanelTop className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">
            Create your first canvas to visually explore your knowledge base.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canvases.map((canvas) => (
            <Card
              key={canvas.id}
              className="p-5 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => router.push(`/canvas/${canvas.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <PanelTop className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold truncate">
                    {canvas.name}
                  </h3>
                  {canvas.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {canvas.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 text-[11px] text-muted-foreground">
                <span>
                  {canvas.itemCount} {canvas.itemCount === 1 ? "item" : "items"}
                </span>
                <span>{timeAgo(canvas.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
