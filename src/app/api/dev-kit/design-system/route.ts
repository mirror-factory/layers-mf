/**
 * GET /api/dev-kit/design-system
 *
 * Returns the project's full design system: tokens (from design-tokens.yaml)
 * + the system spec (from design-system.yaml). One fetch, renders the page.
 */
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/design-system';

export const dynamic = 'force-dynamic';

function readYaml(path: string): string | null {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

export async function GET() {
  const startedAt = Date.now();
  const root = process.cwd();
  const tokens = readYaml(join(root, '.ai-dev-kit', 'registries', 'design-tokens.yaml'));
  const system = readYaml(join(root, '.ai-dev-kit', 'registries', 'design-system.yaml'));
  const components = readYaml(join(root, '.ai-dev-kit', 'registries', 'components.yaml'));

  if (!tokens && !system) {
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'empty',
      duration_ms: Date.now() - startedAt,
      reason: 'design-tokens.yaml and design-system.yaml both missing',
    });
    return NextResponse.json({
      status: 'not_configured',
      hint: 'Run `ai-dev-kit design <feature>` to populate design-tokens.yaml and design-system.yaml',
    }, { status: 200 });
  }

  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: 'ok',
    duration_ms: Date.now() - startedAt,
    meta: {
      has_tokens: Boolean(tokens),
      has_system: Boolean(system),
      has_components: Boolean(components),
    },
  });
  return NextResponse.json({
    status: 'ok',
    tokens_yaml: tokens ?? '',
    system_yaml: system ?? '',
    components_yaml: components ?? '',
  });
}
