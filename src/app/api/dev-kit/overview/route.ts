/**
 * Overview API  --  GET /api/dev-kit/overview
 *
 * Returns aggregated dashboard stats: total cost, avg latency,
 * eval pass rate, active tools count, and system health.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getOverviewStats } from '@/lib/ai-dev-kit/supabase-queries';
import { buildStarterModuleSummary } from '@/lib/dev-kit/starter-dashboard';
import { logKitEvent } from '@/lib/kit-audit';
import { withRoute } from '@/lib/with-route';

const ENDPOINT = '/api/dev-kit/overview';

function localStarterOverview(
  modules: ReturnType<typeof buildStarterModuleSummary>,
) {
  const moduleCount = modules.length;
  const healthyCount = modules.filter(module => module.status === 'healthy').length;
  const degradedCount = modules.filter(module => module.status === 'degraded').length;
  const downCount = modules.filter(module => module.status === 'down').length;

  return {
    kpis: [
      { label: 'Starter Health', value: `${healthyCount}/${moduleCount}`, trend: 0 },
      { label: 'Warnings', value: String(degradedCount), trend: 0 },
      { label: 'Down', value: String(downCount), trend: 0 },
    ],
    modules,
    source: 'starter-local',
  };
}

export const GET = withRoute(async () => {
  const startedAt = Date.now();
  const modules = buildStarterModuleSummary();
  try {
    // Try Langfuse first (if configured)
    const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const langfuseBaseUrl = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';

    if (langfusePublicKey && langfuseSecretKey) {
      try {
        const auth = Buffer.from(`${langfusePublicKey}:${langfuseSecretKey}`).toString('base64');
        const [tracesRes, scoresRes] = await Promise.all([
          fetch(`${langfuseBaseUrl}/api/public/traces?limit=100`, {
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(4_000),
          }),
          fetch(`${langfuseBaseUrl}/api/public/scores?limit=100`, {
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(4_000),
          }),
        ]);
        void scoresRes;
        if (tracesRes.ok) {
          const traces = await tracesRes.json();
          const traceList = traces.data ?? [];
          const totalCost = traceList.reduce((sum: number, t: any) => sum + (t.totalCost ?? 0), 0);
          const avgLatency = traceList.length > 0
            ? traceList.reduce((sum: number, t: any) => sum + (t.latency ?? 0), 0) / traceList.length
            : 0;
          logKitEvent({
            kind: 'dashboard_api',
            name: ENDPOINT,
            phase: 'end',
            outcome: 'ok',
            duration_ms: Date.now() - startedAt,
            meta: { source: 'langfuse', traces: traceList.length },
          });
          return NextResponse.json({
            kpis: [
              { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, trend: 0 },
              { label: 'Avg Latency', value: `${(avgLatency / 1000).toFixed(2)}s`, trend: 0 },
              { label: 'Traces', value: String(traceList.length), trend: 0 },
            ],
            modules,
            source: 'langfuse',
          });
        }
      } catch { /* Fall through to Supabase */ }
    }

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !supabaseKey) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'ok',
        duration_ms: Date.now() - startedAt,
        meta: {
          source: 'starter-local',
          reason: 'hosted telemetry unconfigured',
        },
      });
      return NextResponse.json(localStarterOverview(modules));
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const stats = await getOverviewStats(supabase);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: { source: 'supabase' },
    });
    return NextResponse.json({
      ...stats,
      modules:
        Array.isArray((stats as { modules?: unknown[] }).modules) &&
        (stats as { modules?: unknown[] }).modules?.length
          ? (stats as { modules?: unknown[] }).modules
          : modules,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'warn',
      duration_ms: Date.now() - startedAt,
      reason: 'hosted telemetry failed; returned local starter overview',
      error: message.slice(0, 500),
    });
    return NextResponse.json(localStarterOverview(modules));
  }
});
