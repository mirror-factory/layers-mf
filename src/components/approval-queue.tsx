"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalCard, type ApprovalItem } from "@/components/approval-card";
import { ClipboardCheck } from "lucide-react";

const POLL_INTERVAL = 30_000;

export function ApprovalQueue() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/approval");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchItems]);

  async function handleAction(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/approval/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    const json = await res.json();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? json.item : item))
    );
  }

  const pending = items.filter((i) => i.status === "pending");
  const reviewed = items.filter((i) => i.status !== "pending");

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border bg-muted/50"
          />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">
          Pending{pending.length > 0 && ` (${pending.length})`}
        </TabsTrigger>
        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="space-y-4">
        {pending.length === 0 ? (
          <EmptyState message="No pending approvals. You're all caught up." />
        ) : (
          pending.map((item) => (
            <ApprovalCard key={item.id} item={item} onAction={handleAction} />
          ))
        )}
      </TabsContent>

      <TabsContent value="reviewed" className="space-y-4">
        {reviewed.length === 0 ? (
          <EmptyState message="No reviewed items yet." />
        ) : (
          reviewed.map((item) => (
            <ApprovalCard key={item.id} item={item} onAction={handleAction} />
          ))
        )}
      </TabsContent>

      <TabsContent value="all" className="space-y-4">
        {items.length === 0 ? (
          <EmptyState message="No approval items yet. Granger will propose actions here." />
        ) : (
          items.map((item) => (
            <ApprovalCard key={item.id} item={item} onAction={handleAction} />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <ClipboardCheck className="mb-3 h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
