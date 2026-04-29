/**
 * Vendor registry loader + type exports.
 *
 * Every vendor with a model enum ships a JSON registry at
 * .ai-dev-kit/registries/<vendor>.json. This module loads them, validates
 * the shape, and exposes strongly-typed enums the app can use:
 *
 *   import { ASSEMBLYAI_BATCH_MODELS, assertValidAssemblyaiBatch } from '@/lib/registry';
 *   const model: (typeof ASSEMBLYAI_BATCH_MODELS)[number] = 'universal-3-pro';
 *   assertValidAssemblyaiBatch(userInput);  // throws if not in the registry
 *
 * The registries are the source of truth. Hardcoding a vendor model ID
 * as a string literal in app code is an anti-pattern -- doctor flags it
 * via a grep check, and the Zod schemas generated below will reject it
 * at the type boundary.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface RegistryModelEntry {
  id: string;
  label: string;
  description?: string;
  price_per_hour_usd?: number;
  input_price_per_million_usd?: number;
  output_price_per_million_usd?: number;
  price_per_million_chars_usd?: number;
  price_notes?: string;
  use_for?: string;
  context_window?: number;
  dimensions?: number;
  deprecated: boolean;
}

interface Registry {
  vendor: string;
  label: string;
  docs_root: string;
  console_url: string;
  validated_on: string;
  validated_against_sdk: string;
  required_env: string[];
  batch_models?: RegistryModelEntry[];
  streaming_models?: RegistryModelEntry[];
  chat_models?: RegistryModelEntry[];
  embedding_models?: RegistryModelEntry[];
  speech_models?: RegistryModelEntry[];
  tts_models?: RegistryModelEntry[];
  image_models?: RegistryModelEntry[];
  deprecations?: Array<{ pattern: string; deprecated_on: string; replacement: string; notes?: string }>;
  provenance?: Array<{ url: string; what: string }>;
}

const REGISTRY_DIR = '.ai-dev-kit/registries';

/** Load a single vendor registry by name. Throws on missing or malformed. */
export function loadRegistry(vendor: string, cwd: string = process.cwd()): Registry {
  const path = join(cwd, REGISTRY_DIR, `${vendor}.json`);
  if (!existsSync(path)) {
    throw new Error(`Vendor registry not found: ${path}. Run \`ai-dev-kit registry refresh ${vendor}\`.`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Registry;
  if (raw.vendor !== vendor) {
    throw new Error(`Registry at ${path} declares vendor=${raw.vendor}, expected ${vendor}`);
  }
  return raw;
}

/** List all registries present in the project. */
export function listRegistries(cwd: string = process.cwd()): string[] {
  const dir = join(cwd, REGISTRY_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
}

/** Assert a model id is in the given slot (batch / streaming / chat / etc.). */
export function assertValidModel(
  vendor: string,
  slot: keyof Registry,
  id: string,
  cwd: string = process.cwd(),
): void {
  const registry = loadRegistry(vendor, cwd);
  const entries = registry[slot];
  if (!Array.isArray(entries)) {
    throw new Error(`Vendor ${vendor} has no ${slot} registry slot`);
  }
  const match = (entries as RegistryModelEntry[]).find(e => e.id === id);
  if (!match) {
    const valid = (entries as RegistryModelEntry[]).map(e => e.id).join(', ');
    throw new Error(
      `Invalid ${vendor} ${String(slot)} model: "${id}". Valid values: ${valid}. ` +
      `If the vendor added a new model, update the registry.`,
    );
  }
  if (match.deprecated) {
    // eslint-disable-next-line no-console
    console.warn(`[registry] ${vendor} model "${id}" is deprecated. Migrate.`);
  }
}

/** Days since a registry's validated_on date. Used by doctor staleness check. */
export function registryAgeDays(registry: Registry): number {
  const validated = Date.parse(registry.validated_on);
  if (!Number.isFinite(validated)) return Infinity;
  return Math.floor((Date.now() - validated) / 86_400_000);
}

/**
 * Return the list of valid model IDs for a given vendor + slot.
 * Useful for constructing Zod enums at build time:
 *
 *   import { z } from 'zod';
 *   import { validModels } from '@/lib/registry';
 *   const schema = z.enum(validModels('assemblyai', 'batch_models') as [string, ...string[]]);
 */
export function validModels(
  vendor: string,
  slot: keyof Registry,
  cwd: string = process.cwd(),
): string[] {
  const registry = loadRegistry(vendor, cwd);
  const entries = registry[slot];
  if (!Array.isArray(entries)) return [];
  return (entries as RegistryModelEntry[]).filter(e => !e.deprecated).map(e => e.id);
}
