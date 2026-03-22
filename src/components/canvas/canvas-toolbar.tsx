"use client";

import { useState } from "react";
import {
  Plus,
  StickyNote,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AddItemDialog } from "./add-item-dialog";

interface CanvasToolbarProps {
  canvasId: string;
  canvasName: string;
  onNameChange: (name: string) => void;
  onAddItem: (
    type: "context" | "note" | "label",
    options?: {
      contextItemId?: string;
      content?: string;
      title?: string;
      description_short?: string;
      source_type?: string;
      content_type?: string;
    }
  ) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  zoom: number;
  selectedItem: string | null;
  onDeleteSelected: () => void;
}

export function CanvasToolbar({
  canvasId,
  canvasName,
  onNameChange,
  onAddItem,
  onZoomIn,
  onZoomOut,
  onFitToView,
  zoom,
  selectedItem,
  onDeleteSelected,
}: CanvasToolbarProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card z-10">
        {/* Back */}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/canvas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* Editable name */}
        <Input
          value={canvasName}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-8 max-w-[240px] text-sm font-medium border-transparent hover:border-border focus:border-border"
          placeholder="Untitled canvas"
        />

        <div className="flex-1" />

        {/* Add items */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSearchDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Context Item
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onAddItem("note", { content: "" })
              }
            >
              <StickyNote className="h-3.5 w-3.5 mr-2" />
              Sticky Note
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onAddItem("label", { content: "Label" })
              }
            >
              <Type className="h-3.5 w-3.5 mr-2" />
              Text Label
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border rounded-md px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onZoomOut}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onZoomIn}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onFitToView}
          >
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Delete selected */}
        {selectedItem && (
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        )}
      </div>

      <AddItemDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onAdd={(item) => {
          onAddItem("context", {
            contextItemId: item.id,
            title: item.title,
            description_short: item.description_short ?? undefined,
            source_type: item.source_type,
            content_type: item.content_type,
          });
        }}
      />
    </>
  );
}
