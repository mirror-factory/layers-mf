/**
 * Coverage API  --  GET /api/dev-kit/coverage
 *
 * Returns tool coverage data: each tool from the registry enriched
 * with its test status and eval status so the dashboard can render
 * a coverage grid showing gaps.
 *
 * Error envelope: see /api/dev-kit/cost for shape + rationale.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  getToolRegistry,
  getRegressionTests,
  getEvalRuns,
} from '@/lib/ai-dev-kit/supabase-queries';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/coverage';
const HINT = 'Run `pnpm test:all` to populate unit + regression results, then `pnpm eval` for eval scores.';

interface ToolCoverage {
  id: string;
  name: string;
  category: string;
  hasUnitTests: boolean;
  hasEvalCases: boolean;
  testedInProduction: boolean;
  testStatus: string;
  lastEvalScore: number | null;
}

export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const [tools, regressions, _evalRuns] = await Promise.all([
      getToolRegistry(supabase),
      getRegressionTests(supabase),
      getEvalRuns(supabase),
    ]);

    // Build a set of tool names that have regression tests (tested in prod)
    const prodTestedTools = new Set(regressions.map((r) => r.tool_name));

    const coverage: ToolCoverage[] = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      hasUnitTests: tool.test_status === 'passing' || tool.test_status === 'failing',
      hasEvalCases: tool.last_eval_score !== null,
      testedInProduction: prodTestedTools.has(tool.name),
      testStatus: tool.test_status,
      lastEvalScore: tool.last_eval_score,
    }));

    if (coverage.length === 0) {
      logKitEvent({
        kind: 'dashboard_api',
        name: ENDPOINT,
        phase: 'end',
        outcome: 'empty',
        duration_ms: Date.now() - startedAt,
        reason: 'no tools registered',
      });
      return NextResponse.json({
        coverage: [],
        empty: true,
        reason: 'No tools registered yet. Add one under lib/ai/tools/<name>.ts then run `pnpm exec tsx scripts/sync-registries.ts`.',
        endpoint: ENDPOINT,
      });
    }

    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'ok',
      duration_ms: Date.now() - startedAt,
      meta: { count: coverage.length },
    });
    return NextResponse.json(coverage);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/dev-kit/coverage] Error:', err);
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'fail',
      duration_ms: Date.now() - startedAt,
      reason: 'failed to fetch coverage data',
      error: message.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch coverage data',
        reason: HINT,
        detail: message.split('\n')[0].slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }
}
