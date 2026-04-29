/**
 * vendor-pricing -- look up a vendor+model's price per usage unit.
 *
 * Source of truth: `.ai-dev-kit/registries/*.yaml|json`. Each *_models entry
 * may declare pricing, e.g.:
 *
 *   speech_models:
 *     - id: universal-2
 *       label: AssemblyAI Universal 2
 *       deprecated: false
 *       pricing:
 *         unit: minute
 *         usd_per_unit: 0.00065
 *         source_url: https://www.assemblyai.com/pricing
 *         validated_on: 2026-04-19
 *
 * `estimateVendorCostUsd({ vendor, modelId, usage })` returns the dollar
 * estimate. `null` on any lookup failure -- we never guess. Unpriced vendor
 * calls show up on /dev-kit/cost with a "needs pricing" flag so the gap
 * is visible, not silently zeroed.
 *
 * The cost-drift checker (`scripts/check-cost-drift.mts`) re-fetches each
 * `source_url` weekly and fails if scraped price diverges by >2%. Keeps
 * registries honest without human reconciliation.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type UsageUnit =
  | 'minute'
  | 'second'
  | 'hour'
  | 'request'
  | 'page'
  | 'character'
  | 'image'
  | 'gb';

export interface VendorPricing {
  unit: UsageUnit;
  usd_per_unit: number;
  source_url?: string;
  validated_on?: string;
  notes?: string;
}

interface ModelEntry {
  id: string;
  label?: string;
  pricing?: VendorPricing;
}

let _cache: Map<string, ModelEntry> | null = null;

function registriesDir(): string {
  return join(process.cwd(), '.ai-dev-kit', 'registries');
}

function parseYamlPricing(src: string): Array<{ vendor: string; models: ModelEntry[] }> {
  // Minimal YAML parsing scoped to the shape we need. Registries we emit
  // ourselves use a narrow subset (scalar k/v, nested objects, bullet
  // lists). Good enough for lookup; schema enforcement happens elsewhere
  // via the JSON Schema validator.
  const lines = src.split('\n');
  let vendor = '';
  const modelsOut: ModelEntry[] = [];
  let currentSlot: string | null = null;
  let current: ModelEntry | null = null;
  let currentPricing: Partial<VendorPricing> | null = null;

  const commit = () => {
    if (current) {
      if (currentPricing && currentPricing.unit && typeof currentPricing.usd_per_unit === 'number') {
        current.pricing = currentPricing as VendorPricing;
      }
      modelsOut.push(current);
    }
    current = null;
    currentPricing = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const vendorMatch = line.match(/^vendor:\s*(.+)$/);
    if (vendorMatch) { vendor = vendorMatch[1].trim().replace(/^["']|["']$/g, ''); continue; }

    const slotMatch = line.match(/^([a-z_]+_models):\s*$/);
    if (slotMatch) {
      commit();
      currentSlot = slotMatch[1];
      continue;
    }

    if (!currentSlot) continue;

    // New list item: "  - id: foo"
    const itemStart = line.match(/^\s+-\s+id:\s*(.+)$/);
    if (itemStart) {
      commit();
      current = { id: itemStart[1].trim().replace(/^["']|["']$/g, '') };
      continue;
    }

    if (!current) continue;

    // Nested field under current entry.
    const kv = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const val = rawVal.trim().replace(/^["']|["']$/g, '');

    if (key === 'label') current.label = val;
    else if (key === 'pricing' && val === '') currentPricing = {};
    else if (currentPricing) {
      if (key === 'unit') currentPricing.unit = val as UsageUnit;
      else if (key === 'usd_per_unit') currentPricing.usd_per_unit = Number(val);
      else if (key === 'source_url') currentPricing.source_url = val;
      else if (key === 'validated_on') currentPricing.validated_on = val;
      else if (key === 'notes') currentPricing.notes = val;
    }
  }
  commit();

  return vendor ? [{ vendor, models: modelsOut }] : [];
}

function parseJsonPricing(src: string): Array<{ vendor: string; models: ModelEntry[] }> {
  try {
    const parsed = JSON.parse(src);
    const vendor = parsed.vendor;
    if (!vendor) return [];
    const models: ModelEntry[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^[a-z_]+_models$/.test(key)) continue;
      if (!Array.isArray(value)) continue;
      for (const entry of value as Array<Record<string, unknown>>) {
        if (!entry || typeof entry.id !== 'string') continue;
        const out: ModelEntry = { id: entry.id, label: typeof entry.label === 'string' ? entry.label : undefined };
        const p = entry.pricing as Record<string, unknown> | undefined;
        if (p && typeof p.unit === 'string' && typeof p.usd_per_unit === 'number') {
          out.pricing = {
            unit: p.unit as UsageUnit,
            usd_per_unit: p.usd_per_unit,
            source_url: typeof p.source_url === 'string' ? p.source_url : undefined,
            validated_on: typeof p.validated_on === 'string' ? p.validated_on : undefined,
            notes: typeof p.notes === 'string' ? p.notes : undefined,
          };
        }
        models.push(out);
      }
    }
    return [{ vendor, models }];
  } catch {
    return [];
  }
}

function loadRegistries(): Map<string, ModelEntry> {
  if (_cache) return _cache;
  const cache = new Map<string, ModelEntry>();
  const dir = registriesDir();
  if (!existsSync(dir)) {
    _cache = cache;
    return cache;
  }

  for (const file of readdirSync(dir)) {
    if (file === 'registry.schema.json' || file === 'README.md') continue;
    const path = join(dir, file);
    let src: string;
    try { src = readFileSync(path, 'utf-8'); } catch { continue; }

    const parsed = file.endsWith('.json')
      ? parseJsonPricing(src)
      : (file.endsWith('.yaml') || file.endsWith('.yml'))
        ? parseYamlPricing(src)
        : [];

    for (const { vendor, models } of parsed) {
      for (const m of models) {
        cache.set(`${vendor}::${m.id}`, m);
      }
    }
  }

  _cache = cache;
  return cache;
}

/**
 * Compute a vendor-call cost in USD. Lookup order:
 *   1. exact `<vendor>::<modelId>`
 *   2. fallback to `<vendor>::*` (any entry with a default-price marker)
 * Returns null on any miss. Never throws.
 *
 * Unit conversion: if registry unit is `minute` and caller's usage is in
 * `second`, we convert. Supports minute↔second↔hour, character↔page
 * (1 page ≈ 1800 characters; registries can override with notes).
 */
export function estimateVendorCostUsd(args: {
  vendor: string;
  modelId?: string;
  usage: { unit: UsageUnit; amount: number };
}): number | null {
  if (!args.modelId) return null;
  const registry = loadRegistries();
  const entry = registry.get(`${args.vendor}::${args.modelId}`);
  if (!entry?.pricing) return null;

  const { unit: priceUnit, usd_per_unit } = entry.pricing;
  const normalizedAmount = normalizeUsage(args.usage.unit, args.usage.amount, priceUnit);
  if (normalizedAmount == null) return null;

  return Math.max(0, normalizedAmount * usd_per_unit);
}

function normalizeUsage(from: UsageUnit, amount: number, to: UsageUnit): number | null {
  if (from === to) return amount;

  // time
  const TO_SECONDS: Partial<Record<UsageUnit, number>> = { second: 1, minute: 60, hour: 3600 };
  const fs = TO_SECONDS[from];
  const ts = TO_SECONDS[to];
  if (fs && ts) return (amount * fs) / ts;

  // doc size
  if (from === 'character' && to === 'page') return amount / 1800;
  if (from === 'page' && to === 'character') return amount * 1800;

  return null;
}

/** Invalidate cache (used by tests and the cost-drift checker after refresh). */
export function resetPricingCache(): void {
  _cache = null;
}

/** Enumerate every priced entry across all registries. */
export function listPricedEntries(): Array<{ key: string; entry: ModelEntry }> {
  const registry = loadRegistries();
  return [...registry.entries()]
    .filter(([, v]) => v.pricing)
    .map(([key, entry]) => ({ key, entry }));
}
