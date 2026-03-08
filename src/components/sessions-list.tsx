"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FolderKanban } from "lucide-react";

type Session = {
  id: string;
  name: string;
  goal: string;
  status: string;
  updated_at: string;
  last_agent_run: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  archived: "outline",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SessionsList({ sessions }: { sessions: Session[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => (
        <Link key={s.id} href={`/sessions/${s.id}`}>
          <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-start gap-3">
              <FolderKanban className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium truncate">{s.name}</h3>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "outline"} className="text-[10px] shrink-0">
                    {s.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.goal}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Updated {timeAgo(s.updated_at)}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
