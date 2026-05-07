/**
 * Eval Run Detail API  --  GET /api/dev-kit/evals/[id]
 *
 * Returns a single eval run with all its per-case results.
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getEvalRunById } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/evals/[id]';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const { id } = await params;
    const run = await getEvalRunById(supabase, id);

    if (!run) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'empty',
        duration_ms: Date.now() - startedAt,
        reason: `no eval run with id=${id}`,
      });
      return NextResponse.json(
        { error: 'Eval run not found' },
        { status: 404 },
      );
    }

    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: { id },
    });
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/evals/[id]] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch eval run detail',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      { error: 'Failed to fetch eval run detail' },
      { status: 500 },
    );
  }
}
