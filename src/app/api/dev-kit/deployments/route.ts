/**
 * Deployments API  --  GET /api/dev-kit/deployments
 *
 * Returns deployment snapshots ordered by creation date (newest first).
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getDeployments } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/deployments';

export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const deployments = await getDeployments(supabase);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: Array.isArray(deployments) && deployments.length === 0 ? 'empty' : 'ok',
      duration_ms: Date.now() - startedAt,
      reason: Array.isArray(deployments) && deployments.length === 0 ? 'no deployments recorded' : undefined,
      meta: { count: Array.isArray(deployments) ? deployments.length : 0 },
    });
    return NextResponse.json(deployments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/deployments] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch deployments',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 },
    );
  }
}
