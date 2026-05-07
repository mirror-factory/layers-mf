/**
 * Connectors API  --  GET /api/dev-kit/connectors
 *
 * Returns all connector health statuses from the connectors table.
 *
 * Error envelope: see /api/dev-kit/cost for shape + rationale.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getConnectorStatuses } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/connectors';
const HINT = 'No connectors configured yet. Add one with `ai-dev-kit connector add <name>`.';

export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const connectors = await getConnectorStatuses(supabase);

    if (!Array.isArray(connectors) || connectors.length === 0) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'empty',
        duration_ms: Date.now() - startedAt,
        reason: 'no connectors configured',
      });
      return NextResponse.json({
        connectors: [],
        empty: true,
        reason: HINT,
        endpoint: ENDPOINT,
      });
    }

    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: { count: connectors.length },
    });
    return NextResponse.json(connectors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/connectors] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch connector statuses',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch connector statuses',
        reason: HINT,
        detail: message.split('\n')[0].slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }
}
