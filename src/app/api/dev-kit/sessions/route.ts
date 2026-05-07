/**
 * Sessions API  --  GET /api/dev-kit/sessions
 *
 * Returns a paginated list of traces (sessions) with optional
 * status and model filters.
 *
 * Query params:
 *   ?limit=50&offset=0&status=completed&model=claude-sonnet-4-6
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getTraces } from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/sessions';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    // Try Langfuse first (if configured)
    const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const langfuseBaseUrl = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';

    if (langfusePublicKey && langfuseSecretKey) {
      try {
        const auth = Buffer.from(`${langfusePublicKey}:${langfuseSecretKey}`).toString('base64');
        const res = await fetch(`${langfuseBaseUrl}/api/public/traces?limit=50`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (res.ok) {
          const data = await res.json();
          const traces = (data.data ?? []).map((t: any) => ({
            id: t.id,
            name: t.name || `Trace ${t.id.slice(0, 8)}`,
            status: t.level === 'ERROR' ? 'error' : 'complete',
            model: t.model ?? t.metadata?.model ?? 'unknown',
            totalTokens: (t.usage?.input ?? 0) + (t.usage?.output ?? 0),
            totalCost: t.totalCost ?? 0,
            durationMs: (t.latency ?? 0) * 1000,
            timestamp: t.timestamp ?? t.createdAt,
          }));
          logKitEvent({
            kind: 'dashboard_api',
            name: ENDPOINT,
            phase: 'end',
            outcome: traces.length === 0 ? 'empty' : 'ok',
            duration_ms: Date.now() - startedAt,
            reason: traces.length === 0 ? 'langfuse returned no traces' : undefined,
            meta: { source: 'langfuse', count: traces.length },
          });
          return NextResponse.json(traces);
        }
      } catch {
        // Fall through to Supabase
      }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const status = searchParams.get('status') ?? undefined;
    const model = searchParams.get('model') ?? undefined;

    const traces = await getTraces(supabase, { limit, offset, status, model });
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: Array.isArray(traces) && traces.length === 0 ? 'empty' : 'ok',
      duration_ms: Date.now() - startedAt,
      reason: Array.isArray(traces) && traces.length === 0 ? 'supabase returned no traces' : undefined,
      meta: { source: 'supabase', count: Array.isArray(traces) ? traces.length : 0 },
    });
    return NextResponse.json(traces);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/sessions] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch sessions',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 },
    );
  }
}
