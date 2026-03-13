"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchEntries = useCallback(async (newOffset: number) => {
    setLoading(true);
    const res = await fetch(
      `/api/audit?limit=${PAGE_SIZE}&offset=${newOffset}`
    );
    if (res.ok) {
      const data: AuditEntry[] = await res.json();
      setEntries(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries(offset);
  }, [offset, fetchEntries]);

  return (
    <div className="p-8 max-w-5xl" data-testid="audit-page">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Track actions across your organization.
        </p>
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">No audit entries yet</p>
          <p className="text-xs mt-1">Actions will appear here as they occur.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm" data-testid="audit-table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Resource</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{entry.action}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {entry.resource_type && (
                        <span>
                          {entry.resource_type}
                          {entry.resource_id && (
                            <span className="text-[10px] ml-1 opacity-60">
                              {entry.resource_id.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {entry.user_id ? entry.user_id.slice(0, 8) : "system"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                  </tr>
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
              Showing {offset + 1}–{offset + entries.length}
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
