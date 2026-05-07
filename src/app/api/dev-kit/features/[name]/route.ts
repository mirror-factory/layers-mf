import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/features/[name]';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ name: string }> }

function read(path: string): string | null {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

export async function GET(_req: Request, context: Params) {
  const startedAt = Date.now();
  const { name } = await context.params;
  const root = process.cwd();
  const dir = join(root, 'features', name);

  const spec = read(join(dir, 'SPEC.md'));
  const ia = read(join(dir, 'IA.md'));
  const manifest = read(join(dir, 'TEST-MANIFEST.yaml'));
  const design_ready = existsSync(join(dir, 'DESIGN-READY.md'));

  const anyContent = spec !== null || ia !== null || manifest !== null;
  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: anyContent ? 'ok' : 'empty',
    duration_ms: Date.now() - startedAt,
    reason: anyContent ? undefined : `no spec/ia/manifest found for feature=${name}`,
    meta: { feature: name },
  });
  return NextResponse.json({
    name,
    spec,
    ia,
    manifest,
    design_ready,
  });
}
