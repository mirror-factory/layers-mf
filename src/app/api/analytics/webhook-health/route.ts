import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

interface WebhookEvent {
  provider: string;
  status: string;
  created_at: string;
}

interface ProviderStats {
  provider: string;
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  lastReceived: string | null;
  avgPerDay: number;
}

interface Alert {
  provider: string;
  message: string;
  severity: "warning" | "error";
}

export async function GET() {
  // Auth: require a logged-in user (webhook stats are system-level but still gated)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client to read webhook_events (no RLS / no org_id on this table)
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (admin as any)
    .from("webhook_events")
    .select("provider, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allEvents = (events ?? []) as WebhookEvent[];
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const twoDaysAgo = now - 48 * 60 * 60 * 1000;

  // Group by provider
  const providerMap = new Map<
    string,
    { total: number; completed: number; failed: number; lastReceived: string | null; earliest: string | null }
  >();

  let totalAll = 0;
  let completedAll = 0;
  let failedAll = 0;
  let total24h = 0;
  let completed24h = 0;
  let failed24h = 0;

  for (const event of allEvents) {
    const entry = providerMap.get(event.provider) ?? {
      total: 0,
      completed: 0,
      failed: 0,
      lastReceived: null,
      earliest: null,
    };

    entry.total++;
    if (event.status === "completed") entry.completed++;
    if (event.status === "failed") entry.failed++;

    // Track last and earliest received
    if (!entry.lastReceived || event.created_at > entry.lastReceived) {
      entry.lastReceived = event.created_at;
    }
    if (!entry.earliest || event.created_at < entry.earliest) {
      entry.earliest = event.created_at;
    }

    providerMap.set(event.provider, entry);

    // Totals
    totalAll++;
    if (event.status === "completed") completedAll++;
    if (event.status === "failed") failedAll++;

    // Last 24h
    const ts = new Date(event.created_at).getTime();
    if (ts >= oneDayAgo) {
      total24h++;
      if (event.status === "completed") completed24h++;
      if (event.status === "failed") failed24h++;
    }
  }

  // Build provider stats
  const providers: ProviderStats[] = [];
  const alerts: Alert[] = [];

  for (const [provider, entry] of providerMap) {
    // Calculate avg per day based on date range of events
    let avgPerDay = 0;
    if (entry.earliest && entry.lastReceived && entry.total > 0) {
      const rangeMs =
        new Date(entry.lastReceived).getTime() -
        new Date(entry.earliest).getTime();
      const rangeDays = Math.max(rangeMs / (24 * 60 * 60 * 1000), 1);
      avgPerDay = Math.round((entry.total / rangeDays) * 10) / 10;
    }

    providers.push({
      provider,
      total: entry.total,
      completed: entry.completed,
      failed: entry.failed,
      successRate:
        entry.total > 0
          ? Math.round((entry.completed / entry.total) * 1000) / 1000
          : 0,
      lastReceived: entry.lastReceived,
      avgPerDay,
    });

    // Alert if provider was active but hasn't sent in 24h
    if (entry.lastReceived) {
      const lastTs = new Date(entry.lastReceived).getTime();
      if (lastTs < oneDayAgo && lastTs >= twoDaysAgo) {
        alerts.push({
          provider,
          message: `No webhooks received in 24 hours`,
          severity: "warning",
        });
      } else if (lastTs < twoDaysAgo) {
        alerts.push({
          provider,
          message: `No webhooks received in 48+ hours`,
          severity: "error",
        });
      }
    }
  }

  // Sort providers by total descending
  providers.sort((a, b) => b.total - a.total);

  return NextResponse.json({
    providers,
    totals: {
      total: totalAll,
      completed: completedAll,
      failed: failedAll,
      successRate:
        totalAll > 0
          ? Math.round((completedAll / totalAll) * 1000) / 1000
          : 0,
    },
    last24h: {
      total: total24h,
      completed: completed24h,
      failed: failed24h,
    },
    alerts,
  });
}
