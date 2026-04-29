/**
 * Cost API  --  GET /api/dev-kit/cost
 *
 * Returns cost summary for the specified period and per-model breakdown.
 * Data comes from Langfuse traces persisted in Supabase by the ingest loop.
 *
 * Query params:
 *   ?period=day|week|month  (default: month)
 *
 * Error envelope: when Supabase or Langfuse is misconfigured, return the
 * underlying error message (truncated) plus a diagnostic hint so the user
 * can self-serve instead of hitting "Failed to fetch".
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getCostSummary, getCostByModel } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/cost';
const HINT =
  'Langfuse reachable? Any AI calls made yet? Check `/api/health`, and confirm SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const { searchParams } = request.nextUrl;
    const period = (searchParams.get('period') ?? 'month') as 'day' | 'week' | 'month';

    const [summary, byModel] = await Promise.all([
      getCostSummary(supabase, { period }),
      getCostByModel(supabase),
    ]);

    // Empty-by-design: no traces yet. Return 200 + empty marker so the UI
    // can render an empty state instead of an error.
    const isEmpty =
      (!summary || (typeof summary === 'object' && Object.keys(summary).length === 0)) &&
      Array.isArray(byModel) && byModel.length === 0;
    if (isEmpty) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'empty',
        duration_ms: Date.now() - startedAt,
        reason: 'no AI calls recorded yet',
      });
      return NextResponse.json({
        summary: summary ?? {},
        byModel: byModel ?? [],
        empty: true,
        reason: 'No AI calls recorded yet. Make a call through aiCall() or streamText() and refresh.',
        endpoint: ENDPOINT,
      });
    }

    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: { models: Array.isArray(byModel) ? byModel.length : 0 },
    });
    return NextResponse.json({ summary, byModel });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/cost] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch cost data',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch cost data',
        reason: HINT,
        detail: message.split('\n')[0].slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }
}
