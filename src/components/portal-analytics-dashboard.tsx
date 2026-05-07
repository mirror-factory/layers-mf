"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Eye,
  FileText,
  MessageSquare,
  Wrench,
  Mic,
  Clock,
  Users,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionSummary {
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  pages_viewed: number[];
  docs_opened: string[];
  messages_sent: number;
  tools_used: string[];
  voice_used: boolean;
}

interface AnalyticsSummary {
  total_sessions: number;
  total_events: number;
  sessions: SessionSummary[];
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {detail && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {detail}
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Session Row
// ---------------------------------------------------------------------------

function SessionRow({ session }: { session: SessionSummary }) {
  const duration = session.duration_seconds;
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr =
    mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const toolCounts = session.tools_used.reduce(
    (acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topTools = Object.entries(toolCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {new Date(session.started_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="text-xs text-muted-foreground">
            {durationStr}
          </span>
          {session.voice_used && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
              <Mic className="h-3 w-3" /> Voice
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {session.pages_viewed.length} pages
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {session.docs_opened.length} docs
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {session.messages_sent} messages
          </span>
          {topTools.length > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {topTools.map(([name, count]) => `${name}(${count})`).join(", ")}
            </span>
          )}
        </div>

        {session.docs_opened.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {session.docs_opened.map((doc) => (
              <span
                key={doc}
                className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {doc}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PortalAnalyticsDashboard({
  portalId,
  portalTitle,
}: {
  portalId: string;
  portalTitle: string;
}) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/portals/analytics?portal_id=${encodeURIComponent(portalId)}`
        );
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, [portalId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.total_sessions === 0) {
    return (
      <div className="p-8 text-center space-y-2">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <p className="text-muted-foreground">No viewer activity yet</p>
        <p className="text-xs text-muted-foreground/60">
          Analytics will appear once someone opens the portal
        </p>
      </div>
    );
  }

  // Aggregate stats
  const allPages = new Set(data.sessions.flatMap((s) => s.pages_viewed));
  const allDocs = new Set(data.sessions.flatMap((s) => s.docs_opened));
  const totalMessages = data.sessions.reduce(
    (sum, s) => sum + s.messages_sent,
    0
  );
  const totalTools = data.sessions.reduce(
    (sum, s) => sum + s.tools_used.length,
    0
  );
  const avgDuration = Math.round(
    data.sessions.reduce((sum, s) => sum + s.duration_seconds, 0) /
      data.sessions.length
  );
  const voiceSessions = data.sessions.filter((s) => s.voice_used).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{portalTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Viewer engagement analytics
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total Sessions"
          value={data.total_sessions}
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={avgDuration > 60 ? `${Math.floor(avgDuration / 60)}m` : `${avgDuration}s`}
          detail={`${data.total_events} total events`}
        />
        <StatCard
          icon={Eye}
          label="Pages Viewed"
          value={allPages.size}
          detail={`across ${allDocs.size} documents`}
        />
        <StatCard
          icon={MessageSquare}
          label="Messages Sent"
          value={totalMessages}
          detail={`${totalTools} tool uses, ${voiceSessions} voice sessions`}
        />
      </div>

      {/* Session timeline */}
      <div>
        <h3 className="text-sm font-medium mb-3">Sessions</h3>
        <div className="space-y-2">
          {data.sessions
            .sort(
              (a, b) =>
                new Date(b.started_at).getTime() -
                new Date(a.started_at).getTime()
            )
            .map((session) => (
              <SessionRow key={session.session_id} session={session} />
            ))}
        </div>
      </div>
    </div>
  );
}
