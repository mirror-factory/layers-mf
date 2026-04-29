/**
 * Evaluations API  --  GET /api/dev-kit/evals
 *
 * Returns all eval suites and their most recent runs. Data is persisted to
 * Supabase by the promptfoo ingest job (scripts/ingest-promptfoo.ts reads
 * evals/results/*.json and upserts).
 *
 * Query params:
 *   ?suiteId=<uuid>  -- filter runs to a specific suite
 *
 * Error envelope: see /api/dev-kit/cost for the shape + rationale.
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getEvalSuites, getEvalRuns } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/evals';
const HINT = 'Run `pnpm eval` to populate evals/results/*.json, then the ingest job writes to Supabase.';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const { searchParams } = request.nextUrl;
    const suiteId = searchParams.get('suiteId') ?? undefined;

    const [suites, runs] = await Promise.all([
      getEvalSuites(supabase),
      getEvalRuns(supabase, suiteId),
    ]);

    const isEmpty =
      (!Array.isArray(suites) || suites.length === 0) &&
      (!Array.isArray(runs) || runs.length === 0);
    if (isEmpty) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'empty',
        duration_ms: Date.now() - startedAt,
        reason: 'no eval suites or runs yet',
      });
      return NextResponse.json({
        suites: suites ?? [],
        runs: runs ?? [],
        empty: true,
        reason: 'No eval runs recorded yet. Run `pnpm eval` to populate.',
        endpoint: ENDPOINT,
      });
    }

    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: {
        suites: Array.isArray(suites) ? suites.length : 0,
        runs: Array.isArray(runs) ? runs.length : 0,
      },
    });
    return NextResponse.json({ suites, runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/evals] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch evaluations',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch evaluations',
        reason: HINT,
        detail: message.split('\n')[0].slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }
}
