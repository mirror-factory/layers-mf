import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type DevKitModuleStatus = 'healthy' | 'degraded' | 'down';

export interface DevKitModuleSummary {
  name: string;
  status: DevKitModuleStatus;
  detail?: string;
}

interface Scorecard {
  score?: number;
  blockers?: string[];
}

function readJson<T>(cwd: string, relPath: string): T | null {
  try {
    const abs = join(cwd, relPath);
    if (!existsSync(abs)) return null;
    return JSON.parse(readFileSync(abs, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function registryStats(cwd: string) {
  const abs = join(cwd, '.ai-dev-kit/registries');
  if (!existsSync(abs)) return { total: 0, populated: 0, entries: 0 };

  let total = 0;
  let populated = 0;
  let entries = 0;

  for (const file of readdirSync(abs)) {
    if (!file.endsWith('.yaml')) continue;
    total += 1;
    try {
      const src = readFileSync(join(abs, file), 'utf-8');
      const entryCount = (src.match(/^\s+-\s+/gm) ?? []).length;
      const hasDesignTokenContent =
        file === 'design-tokens.yaml' &&
        /^(colors|typography|spacing|radius|shadow|motion|elevation):/m.test(src);
      const hasDesignSystemContent =
        file === 'design-system.yaml' && /^primitives:\s*\n\s+\w+/m.test(src);
      const hasUsableContent =
        entryCount > 0 || hasDesignTokenContent || hasDesignSystemContent;

      entries += entryCount;
      if (hasUsableContent) populated += 1;
    } catch {
      // Treat unreadable registries as present but not populated.
    }
  }

  return { total, populated, entries };
}

function statusFromScore(score: number | null, blockers: number): DevKitModuleStatus {
  if (blockers > 0) return 'down';
  if (score === null) return 'degraded';
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'degraded';
  return 'down';
}

export function buildStarterModuleSummary(
  cwd = process.cwd(),
): DevKitModuleSummary[] {
  const scorecard = readJson<Scorecard>(
    cwd,
    '.ai-starter/runs/latest-scorecard.json',
  );
  const features = readJson<unknown[]>(
    cwd,
    '.ai-starter/manifests/features.json',
  );
  const docs = readJson<unknown[]>(cwd, '.ai-starter/manifests/docs.json');
  const hooks = readJson<unknown[]>(cwd, '.ai-starter/manifests/hooks.json');
  const integrations = readJson<unknown[]>(
    cwd,
    '.ai-starter/manifests/integrations.json',
  );
  const exportSummary = readJson<{ archivePath?: string; createdAt?: string }>(
    cwd,
    '.ai-starter/exports/latest.json',
  );

  const score = typeof scorecard?.score === 'number' ? scorecard.score : null;
  const blockers = Array.isArray(scorecard?.blockers)
    ? scorecard.blockers.length
    : 0;
  const registries = registryStats(cwd);

  return [
    {
      name: 'Starter score',
      status: statusFromScore(score, blockers),
      detail:
        score === null
          ? 'No starter scorecard found'
          : `${score}/100, ${blockers} blocker${blockers === 1 ? '' : 's'}`,
    },
    {
      name: 'Feature manifest',
      status:
        Array.isArray(features) && features.length > 0 ? 'healthy' : 'down',
      detail: Array.isArray(features)
        ? `${features.length} surfaces tracked`
        : 'Missing .ai-starter/manifests/features.json',
    },
    {
      name: 'Docs research',
      status: Array.isArray(docs) && docs.length > 0 ? 'healthy' : 'degraded',
      detail: Array.isArray(docs)
        ? `${docs.length} docs and reference files indexed`
        : 'No docs manifest found',
    },
    {
      name: 'Hooks',
      status: Array.isArray(hooks) && hooks.length > 0 ? 'healthy' : 'degraded',
      detail: Array.isArray(hooks)
        ? `${hooks.length} Claude/Codex hook entries indexed`
        : 'No hook manifest found',
    },
    {
      name: 'Integrations',
      status:
        Array.isArray(integrations) && integrations.length > 0
          ? 'healthy'
          : 'degraded',
      detail: Array.isArray(integrations)
        ? `${integrations.length} API/provider integrations tracked`
        : 'No integration manifest found',
    },
    {
      name: 'Dev-kit registries',
      status:
        registries.total === 0
          ? 'degraded'
          : registries.populated === registries.total
            ? 'healthy'
            : 'degraded',
      detail:
        registries.total > 0
          ? `${registries.populated}/${registries.total} populated, ${registries.entries} entries`
          : 'Run pnpm exec tsx scripts/sync-registries.ts',
    },
    {
      name: 'Evidence export',
      status: exportSummary?.archivePath ? 'healthy' : 'degraded',
      detail: exportSummary?.createdAt
        ? `Latest export ${new Date(exportSummary.createdAt).toLocaleString()}`
        : 'Run pnpm evidence:export',
    },
  ];
}

export function starterManifestMtime(cwd = process.cwd()) {
  const abs = join(cwd, '.ai-starter/manifests/features.json');
  if (!existsSync(abs)) return null;
  return statSync(abs).mtime.toISOString();
}
