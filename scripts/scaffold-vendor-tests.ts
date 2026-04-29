#!/usr/bin/env tsx
/**
 * scaffold-vendor-tests -- emit one live integration test per vendor in
 * .ai-dev-kit/registries/.
 *
 * Runs during `ai-dev-kit onboard` and on any `migrate`. For each vendor
 * registry file (excluding registries with `kind:` set -- those are the
 * components/pages/tools/skills auto-registries, not vendor registries),
 * ensures `tests/integration/<vendor>.live.test.ts` exists.
 *
 * The test is a SKELETON, not a complete spec: it wires up env-var guards,
 * a single happy-path call per `*_models` slot (or operation), and a
 * per-run cost cap. The author fills in the assertion details.
 *
 * Why this exists: the user explicitly called out "are we actually testing
 * the non-LLM APIs fully?" -- e.g. AssemblyAI's transcription, Firecrawl's
 * scrape. Without a per-vendor test, registries are declarative promises
 * with nothing holding them true in CI.
 *
 * Policy:
 *   * Never overwrites an existing file. Always additive.
 *   * Gated on `required_env` -- tests skip when the env var is unset,
 *     so CI without secrets doesn't break.
 *   * Logs to stdout each vendor touched: "created" | "exists" | "skipped".
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const REG_DIR = join(CWD, '.ai-dev-kit', 'registries');
const TESTS_DIR = join(CWD, 'tests', 'integration');

interface VendorInfo {
  vendor: string;
  label: string;
  required_env: string[];
  slots: Array<{ slot: string; ids: string[] }>;
}

function parseVendor(path: string): VendorInfo | null {
  if (!existsSync(path)) return null;
  const src = readFileSync(path, 'utf-8');

  if (path.endsWith('.json')) {
    try {
      const parsed = JSON.parse(src);
      if (!parsed.vendor || typeof parsed.vendor !== 'string') return null;
      // Skip the auto-registries (they have a `kind:` field, vendors don't).
      if (parsed.kind) return null;
      const slots: VendorInfo['slots'] = [];
      for (const [k, v] of Object.entries(parsed)) {
        if (!/^[a-z_]+_models$/.test(k) || !Array.isArray(v)) continue;
        slots.push({
          slot: k,
          ids: (v as Array<Record<string, unknown>>).map(e => String(e.id)).filter(id => id !== 'undefined'),
        });
      }
      return {
        vendor: parsed.vendor,
        label: parsed.label ?? parsed.vendor,
        required_env: Array.isArray(parsed.required_env) ? parsed.required_env : [],
        slots,
      };
    } catch { return null; }
  }
  // YAML vendor registries: best-effort parse (we only need vendor + required_env + slots).
  const vendorMatch = src.match(/^vendor:\s*(.+)$/m);
  if (!vendorMatch) return null;
  // If it has kind:, it's an auto-registry, not a vendor registry.
  if (/^kind:/m.test(src)) return null;
  const labelMatch = src.match(/^label:\s*(.+)$/m);
  const envMatch = [...src.matchAll(/^\s+-\s+(\w+)\s*$/gm)];
  return {
    vendor: vendorMatch[1].trim().replace(/^["']|["']$/g, ''),
    label: labelMatch?.[1]?.trim().replace(/^["']|["']$/g, '') ?? vendorMatch[1].trim(),
    required_env: envMatch.map(m => m[1]),
    slots: [],
  };
}

function skeleton(info: VendorInfo): string {
  const envGuards = info.required_env.map(v => `const ${v.replace(/[^A-Z0-9]/gi, '_')} = process.env.${v};`).join('\n');
  const haveAllEnv = info.required_env.map(v => `${v.replace(/[^A-Z0-9]/gi, '_')}`).join(' && ');
  const firstSlot = info.slots[0];
  const firstId = firstSlot?.ids[0];

  return `/**
 * ${info.label} -- live integration test.
 *
 * Scaffolded by scripts/scaffold-vendor-tests.ts. Fill in the actual call
 * shape for the vendor's SDK. This file enforces:
 *
 *   1. Env vars are set (skip if not, so CI without secrets passes).
 *   2. A happy-path call runs against the vendor.
 *   3. Cost is attributed via withExternalCall so /dev-kit/cost shows it.
 *   4. Results are minimally assertable (response has an expected field).
 *
 * Run: pnpm test:live    (or) pnpm vitest run tests/integration/${info.vendor}.live.test.ts
 */
import { describe, it, expect } from 'vitest';
import { withExternalCall } from '@/lib/with-external';

${envGuards}
const LIVE = ${haveAllEnv || 'false'};

describe.skipIf(!LIVE)('${info.label} live', () => {
  it('happy path: ${firstSlot?.slot ?? 'operation'}', async () => {
    const result = await withExternalCall(
      { vendor: '${info.vendor}', operation: '${firstSlot?.slot ?? 'test'}', modelId: ${firstId ? JSON.stringify(firstId) : 'undefined'} },
      async () => {
        // TODO: invoke ${info.label}'s SDK here and return the result.
        // Example:
        //   const client = new ${info.label.replace(/\s+/g, '')}Client({ apiKey: ${info.required_env[0] ? info.required_env[0].replace(/[^A-Z0-9]/gi, '_') : '""'} });
        //   return client.${firstSlot?.slot ?? 'someMethod'}.create({ model: '${firstId ?? 'default'}', ... });
        throw new Error('scaffold: implement this call');
      },
      {
        usage: { unit: 'request', amount: 1 },
        summarizeResult: (r) => ({ ok: !!r }),
      },
    );
    expect(result).toBeDefined();
  });
});
`;
}

function main(): void {
  if (!existsSync(REG_DIR)) {
    console.log('[scaffold-vendor-tests] no registries dir; nothing to scaffold.');
    return;
  }
  mkdirSync(TESTS_DIR, { recursive: true });

  for (const file of readdirSync(REG_DIR)) {
    if (file === 'registry.schema.json' || file === 'README.md') continue;
    if (file === 'components.yaml' || file === 'pages.yaml' || file === 'tools.yaml' || file === 'skills.yaml' || file === 'design-tokens.yaml') continue;
    const info = parseVendor(join(REG_DIR, file));
    if (!info) continue;

    const out = join(TESTS_DIR, `${info.vendor}.live.test.ts`);
    if (existsSync(out)) {
      console.log(`[scaffold-vendor-tests] ${info.vendor}: exists (skipped)`);
      continue;
    }
    writeFileSync(out, skeleton(info));
    console.log(`[scaffold-vendor-tests] ${info.vendor}: created ${out}`);
  }
}

main();
