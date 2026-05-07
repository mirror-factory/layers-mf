#!/usr/bin/env tsx
/**
 * check-cost-drift -- weekly sanity check that registry prices still match
 * the vendor's pricing page.
 *
 * How it works:
 *   1. For every `*_models` entry in `.ai-dev-kit/registries/*` with a
 *      `pricing.source_url`, Firecrawl the URL.
 *   2. Ask `models.classifier` to extract the current USD price for the
 *      specific model ID from the scraped markdown.
 *   3. Compare to registry `pricing.usd_per_unit`. If drift > THRESHOLD
 *      (default 2%), emit a notify blocker + exit 1.
 *   4. If match, rewrite `pricing.validated_on` to today's date so the
 *      check doesn't repeat for 7 days.
 *
 * Runs from GitHub Actions weekly (templates/.github/workflows/cost-drift.yml)
 * and is also exposed as `pnpm check:cost-drift` for manual re-validation.
 *
 * Failure modes (soft, pass with warning):
 *   * Firecrawl not configured -> skip.
 *   * LLM unreachable -> skip.
 *   * Scraped markdown doesn't mention the model -> skip with warning.
 *
 * Hard failure (blocker + exit 1):
 *   * Clear price found, drifts > threshold.
 *   * Registry missing `source_url` for an entry with `pricing`.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const REG_DIR = join(CWD, '.ai-dev-kit', 'registries');
const THRESHOLD = 0.02; // 2%

interface Entry {
  file: string;
  vendor: string;
  slot: string;
  id: string;
  pricing: {
    unit: string;
    usd_per_unit: number;
    source_url?: string;
    validated_on?: string;
  };
}

function enumerateEntries(): Entry[] {
  if (!existsSync(REG_DIR)) return [];
  const out: Entry[] = [];

  for (const file of readdirSync(REG_DIR)) {
    if (file === 'registry.schema.json' || file === 'README.md') continue;
    const path = join(REG_DIR, file);
    const src = readFileSync(path, 'utf-8');

    if (file.endsWith('.json')) {
      try {
        const parsed = JSON.parse(src);
        const vendor = parsed.vendor;
        if (!vendor) continue;
        for (const [slot, models] of Object.entries(parsed)) {
          if (!/^[a-z_]+_models$/.test(slot) || !Array.isArray(models)) continue;
          for (const m of models as Array<Record<string, unknown>>) {
            const p = m.pricing as Entry['pricing'] | undefined;
            if (p?.unit && typeof p.usd_per_unit === 'number' && typeof m.id === 'string') {
              out.push({ file, vendor, slot, id: m.id, pricing: p });
            }
          }
        }
      } catch { /* skip */ }
    }
    // YAML vendor registries would need parsing too -- omitted for brevity
    // since the core schema shipped as JSON. Add YAML parsing if needed.
  }

  return out;
}

async function firecrawl(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.markdown ?? null;
  } catch { return null; }
}

async function extractPrice(args: { markdown: string; modelId: string; unit: string }): Promise<number | null> {
  try {
    const { aiCall } = await import(join(CWD, 'lib', 'ai-call.ts'));
    const result = await aiCall({
      mode: 'generate',
      modelId: 'anthropic/claude-haiku-4.5',
      prompt: [
        `Extract the USD price per ${args.unit} for model ID "${args.modelId}" from the pricing page below.`,
        'Return ONLY a JSON object: {"usd_per_unit": <number>} or {"usd_per_unit": null} if the model is not mentioned.',
        '',
        args.markdown.slice(0, 12000),
      ].join('\n'),
      label: 'cost-drift-extract',
    });
    const match = result.text.match(/\{[\s\S]*?\}/)?.[0];
    if (!match) return null;
    const parsed = JSON.parse(match);
    return typeof parsed.usd_per_unit === 'number' ? parsed.usd_per_unit : null;
  } catch {
    return null;
  }
}

async function notifyBlocker(title: string, body: string): Promise<void> {
  try {
    const mod = await import(join(CWD, 'lib', 'notify.ts'));
    await mod.notify({ kind: 'blocker', title, body });
  } catch { /* silent */ }
}

async function main(): Promise<number> {
  const entries = enumerateEntries();
  if (entries.length === 0) {
    console.log('[check-cost-drift] no priced registry entries; nothing to check.');
    return 0;
  }

  let failed = 0;
  for (const e of entries) {
    if (!e.pricing.source_url) {
      console.error(`[check-cost-drift] FAIL ${e.vendor}:${e.id} -- pricing declared but source_url missing`);
      failed++;
      continue;
    }

    const md = await firecrawl(e.pricing.source_url);
    if (!md) {
      console.warn(`[check-cost-drift] SKIP ${e.vendor}:${e.id} -- Firecrawl unreachable`);
      continue;
    }

    const scraped = await extractPrice({ markdown: md, modelId: e.id, unit: e.pricing.unit });
    if (scraped == null) {
      console.warn(`[check-cost-drift] SKIP ${e.vendor}:${e.id} -- model not found on pricing page`);
      continue;
    }

    const registered = e.pricing.usd_per_unit;
    const drift = Math.abs(scraped - registered) / Math.max(registered, 0.000001);
    if (drift > THRESHOLD) {
      console.error(`[check-cost-drift] DRIFT ${e.vendor}:${e.id}  registered=${registered}  scraped=${scraped}  drift=${(drift * 100).toFixed(1)}%`);
      await notifyBlocker(
        `Cost drift: ${e.vendor}:${e.id}`,
        `Registered: $${registered}/${e.pricing.unit}\nScraped: $${scraped}/${e.pricing.unit}\nDrift: ${(drift * 100).toFixed(1)}%\nSource: ${e.pricing.source_url}`,
      );
      failed++;
    } else {
      console.log(`[check-cost-drift] OK ${e.vendor}:${e.id}  drift=${(drift * 100).toFixed(2)}%`);
      // Future: write-back validated_on = today. Skipped on drift check to
      // keep this script read-only; the cost-registry-refresh action does writes.
    }
  }

  return failed > 0 ? 1 : 0;
}

main().then(code => process.exit(code));
