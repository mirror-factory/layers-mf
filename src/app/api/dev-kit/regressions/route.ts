/**
 * Regressions API  --  GET /api/dev-kit/regressions
 *
 * Returns all auto-generated regression tests ordered by creation
 * date (newest first).
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getRegressionTests } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/regressions';

export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const regressions = await getRegressionTests(supabase);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: Array.isArray(regressions) && regressions.length === 0 ? 'empty' : 'ok',
      duration_ms: Date.now() - startedAt,
      reason: Array.isArray(regressions) && regressions.length === 0 ? 'no regression tests recorded' : undefined,
      meta: { count: Array.isArray(regressions) ? regressions.length : 0 },
    });
    return NextResponse.json(regressions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/regressions] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch regression tests',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      { error: 'Failed to fetch regression tests' },
      { status: 500 },
    );
  }
}
