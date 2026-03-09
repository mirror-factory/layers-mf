"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionItemRow } from "@/components/actions/action-item-row";
import type { ActionItem } from "@/lib/db/action-items";

const PAGE_SIZE = 50;

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter !== "all") params.set("sourceType", sourceFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    const res = await fetch(`/api/actions?${params}`);
    if (res.ok) {
      const data: ActionItem[] = await res.json();
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [statusFilter, sourceFilter, offset]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, sourceFilter]);

  async function handleStatusChange(
    contextItemId: string,
    actionIndex: number,
    newStatus: "pending" | "done" | "cancelled"
  ) {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.context_item_id === contextItemId && item.action_index === actionIndex
          ? {
              ...item,
              status: newStatus,
              completed_at:
                newStatus === "done" ? new Date().toISOString() : null,
            }
          : item
      )
    );

    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextItemId, actionIndex, status: newStatus }),
    });

    if (!res.ok) {
      // Revert on failure
      fetchItems();
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Action Items</h1>
        <p className="text-muted-foreground text-sm">
          Tasks extracted from your documents, meetings, and messages.
        </p>
      </div>

      {/* Stats + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{pendingCount}</span> pending
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{doneCount}</span> done
          </span>
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="done" className="text-xs">Done</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              <SelectItem value="upload" className="text-xs">Uploads</SelectItem>
              <SelectItem value="granola" className="text-xs">Granola</SelectItem>
              <SelectItem value="linear" className="text-xs">Linear</SelectItem>
              <SelectItem value="gdrive" className="text-xs">Drive</SelectItem>
              <SelectItem value="github" className="text-xs">GitHub</SelectItem>
              <SelectItem value="discord" className="text-xs">Discord</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CheckSquare className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">No action items found</p>
          <p className="text-xs mt-1">
            Action items will appear here as documents are processed.
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 px-4 py-2" />
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Task
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Source
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="w-10 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <ActionItemRow
                    key={`${item.context_item_id}-${item.action_index}`}
                    item={item}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Showing {offset + 1}–{offset + items.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
