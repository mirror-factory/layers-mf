/**
 * GET /api/observability/health -- "are my logs actually reaching a sink?"
 *
 * Designed to answer the "silent sink" failure mode: telemetry is wired,
 * every route looks fine, but nothing reaches Langfuse / Supabase because
 * an env var is missing or the backend is throwing. A passing compliance
 * check isn't enough -- this endpoint confirms *recent runtime output*
 * reached at least one configured sink.
 *
 * What it reports:
 *   - configured sinks (stdout is always configured; others based on env)
 *   - recent-event counts per sink (last hour, from the in-memory ring)
 *   - warnings when no events have been observed despite activity
 *
 * The stdout sink is always considered healthy -- if it weren't, we
 * couldn't run at all. Langfuse and Supabase report based on whether
 * configured + whether events have been sent in the last hour.
 */

import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { recordSinkEvent, getSinkStats } from '@/lib/sink-stats';

export const GET = withRoute(async () => {
  // Touch our own sink so `recent-events` is never zero while the server
  // is alive. This is the equivalent of a canary request.
  recordSinkEvent('stdout');

  const stats = getSinkStats();
  const langfuseConfigured = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  const supabaseConfigured = Boolean(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  const sinks = {
    stdout: { configured: true, recentEvents: stats.stdout, status: 'ok' as const },
    langfuse: {
      configured: langfuseConfigured,
      recentEvents: stats.langfuse,
      status: !langfuseConfigured
        ? 'not-configured'
        : stats.langfuse > 0
          ? 'ok'
          : 'silent',
    },
    supabase: {
      configured: supabaseConfigured,
      recentEvents: stats.supabase,
      status: !supabaseConfigured
        ? 'not-configured'
        : stats.supabase > 0
          ? 'ok'
          : 'silent',
    },
  };

  const warnings: string[] = [];
  if (sinks.langfuse.status === 'silent') {
    warnings.push('Langfuse is configured but has received 0 events recently. Logs may not be flowing.');
  }
  if (sinks.supabase.status === 'silent') {
    warnings.push('Supabase is configured but has received 0 events recently. Logs may not be flowing.');
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    sinks,
    warnings,
  });
});
