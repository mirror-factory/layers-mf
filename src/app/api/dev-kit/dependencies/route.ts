import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const path = join(process.cwd(), '.ai-dev-kit', 'registries', 'dependencies.yaml');
  if (!existsSync(path)) {
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'empty',
      duration_ms: Date.now() - startedAt,
      reason: 'dependencies.yaml not generated',
    });
    return NextResponse.json({ status: 'not_configured', hint: 'Run `pnpm exec tsx scripts/sync-dependencies.ts`' }, { status: 200 });
  }
  const yaml = readFileSync(path, 'utf-8');
  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: 'ok',
    duration_ms: Date.now() - startedAt,
    meta: { bytes: yaml.length },
  });
  return NextResponse.json({ status: 'ok', yaml });
}
