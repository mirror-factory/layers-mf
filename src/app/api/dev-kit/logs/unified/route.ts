/**
 * GET /api/dev-kit/logs/unified -- merged view of every configured log sink.
 *
 * Query params:
 *   limit=<n>           max events (default 200)
 *   since=<iso>         events after this timestamp
 *   sources=a,b,c       restrict to specific sinks (stdout|file|supabase|langfuse|dev3000)
 *
 * Returns:
 *   {
 *     sinks: { stdout: true, file: true, supabase: false, langfuse: true, dev3000: false },
 *     events: UnifiedEvent[],
 *     warnings: string[]
 *   }
 *
 * The dashboard's /dev-kit/logs page consumes this to render the unified
 * timeline. Doctor hits it as part of the Observability check to confirm
 * at least one persistent sink is flowing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { fetchUnified, configuredSinks, type UnifiedEvent } from '@/lib/log-aggregator';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/logs/unified';

export const GET = withRoute(async (req: NextRequest) => {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 200);
  const sinceIso = url.searchParams.get('since') ?? undefined;
  const sourcesParam = url.searchParams.get('sources');
  const sources = sourcesParam ? sourcesParam.split(',').map(s => s.trim()) as UnifiedEvent['source'][] : undefined;

  const sinks = configuredSinks(process.cwd());
  const events = await fetchUnified(process.cwd(), { limit, sinceIso, sources });

  // Warn when only stdout is configured -- the project has no persistent
  // sink and will lose observability on restart.
  const persistent = [sinks.file, sinks.supabase, sinks.langfuse].filter(Boolean).length;
  const warnings: string[] = [];
  if (persistent === 0) {
    warnings.push('Only stdout is configured. Logs will not survive a process restart. Enable file backend (AI_LOG_BACKEND=file), Supabase, or Langfuse.');
  }
  if (sinks.supabase && events.filter(e => e.source === 'supabase').length === 0) {
    warnings.push('Supabase configured but 0 events retrieved. Verify ai_logs table and service-role key.');
  }
  if (sinks.langfuse && events.filter(e => e.source === 'langfuse').length === 0) {
    warnings.push('Langfuse configured but 0 generations retrieved. Verify keys and base URL.');
  }

  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: events.length === 0 ? 'empty' : warnings.length > 0 ? 'warn' : 'ok',
    duration_ms: Date.now() - startedAt,
    reason: events.length === 0 ? 'no events returned across configured sinks' : undefined,
    meta: { events: events.length, warnings: warnings.length },
  });
  return NextResponse.json({ sinks, events, warnings });
});
