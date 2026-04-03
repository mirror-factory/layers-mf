"use client";

import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ExternalLink,
  Tag,
  FolderInput,
  Trash2,
  History,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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

interface LibraryContextMenuProps {
  item: ContextItem;
  children: React.ReactNode;
  onAddTags?: (item: ContextItem) => void;
  onMoveToFolder?: (item: ContextItem) => void;
  onViewHistory?: (item: ContextItem) => void;
}

export function LibraryContextMenu({
  item,
  children,
  onAddTags,
  onMoveToFolder,
  onViewHistory,
}: LibraryContextMenuProps) {
  const router = useRouter();

  const handleOpenInChat = () => {
    router.push(`/chat?context=${item.id}`);
  };

  const handleOpenInViewer = () => {
    router.push(`/context/${item.id}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/context/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // silent fail
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={handleOpenInChat}
          className="gap-2 text-sm"
        >
          <MessageSquare className="h-4 w-4" />
          Open in Chat
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleOpenInViewer}
          className="gap-2 text-sm"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Viewer
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => onAddTags?.(item)}
          className="gap-2 text-sm"
        >
          <Tag className="h-4 w-4" />
          Add Tags
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onMoveToFolder?.(item)}
          className="gap-2 text-sm"
        >
          <FolderInput className="h-4 w-4" />
          Move to Folder
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onViewHistory?.(item)}
          className="gap-2 text-sm"
        >
          <History className="h-4 w-4" />
          View Version History
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={handleDelete}
          className="gap-2 text-sm text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
