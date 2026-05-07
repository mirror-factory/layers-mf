import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/features';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const root = process.cwd();
  const dir = join(root, 'features');
  if (!existsSync(dir)) {
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'empty',
      duration_ms: Date.now() - startedAt,
      reason: 'features directory missing',
    });
    return NextResponse.json({ features: [] });
  }
  const features = readdirSync(dir).filter(n => !n.startsWith('_') && statSync(join(dir, n)).isDirectory());
  const out = features.map(name => {
    const fdir = join(dir, name);
    const specExists = existsSync(join(fdir, 'SPEC.md'));
    const designReady = existsSync(join(fdir, 'DESIGN-READY.md'));
    const manifestPath = join(fdir, 'TEST-MANIFEST.yaml');
    const manifestExists = existsSync(manifestPath);
    const manifestSrc = manifestExists ? readFileSync(manifestPath, 'utf-8') : '';
    const flows = (manifestSrc.match(/^\s+-\s+name:\s/gm) || []).length;
    return { name, specExists, designReady, manifestExists, flows };
  });
  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: out.length === 0 ? 'empty' : 'ok',
    duration_ms: Date.now() - startedAt,
    reason: out.length === 0 ? 'no feature directories' : undefined,
    meta: { count: out.length },
  });
  return NextResponse.json({ features: out });
}
