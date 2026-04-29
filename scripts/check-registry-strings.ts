#!/usr/bin/env tsx
/**
 * check-registry-strings -- detect hardcoded vendor model IDs that bypass the registries.
 *
 * Runs in pre-commit. Design rule: zero hardcoded vendor knowledge in this
 * file. Everything about what patterns to match and what IDs are valid
 * comes from the JSON files in .ai-dev-kit/registries/ at scan time.
 *
 * Flow:
 *   1. Load every registry in .ai-dev-kit/registries/*.json
 *   2. Collect each registry's id_patterns (regex strings) and its full
 *      set of valid model IDs across every *_models slot
 *   3. Compile the patterns into one big combined regex
 *   4. Scan lib/ and app/ source files for string literals that match
 *   5. For each match, check the set of valid IDs. Flag any that aren't
 *      registered.
 *
 * Empty registry dir => scanner no-ops with a pass message. New project
 * that hasn't added any vendors yet gets no false positives.
 *
 * Adding a new vendor: drop a JSON in .ai-dev-kit/registries/ with
 * id_patterns populated. The scanner picks it up on next run. Zero edits
 * to this file.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const CWD = process.cwd();
const REG_DIR = join(CWD, '.ai-dev-kit/registries');

interface ModelEntry { id: string; deprecated: boolean }
interface Registry {
  vendor: string;
  id_patterns?: string[];
  [slot: string]: unknown;
}

interface LoadedRegistry {
  vendor: string;
  patterns: RegExp[];
  ids: Set<string>;
}

function loadAllRegistries(): LoadedRegistry[] {
  const out: LoadedRegistry[] = [];
  if (!existsSync(REG_DIR)) return out;

  for (const file of readdirSync(REG_DIR)) {
    if (!file.endsWith('.json') || file === 'registry.schema.json') continue;
    try {
      const reg = JSON.parse(readFileSync(join(REG_DIR, file), 'utf-8')) as Registry;
      if (typeof reg.vendor !== 'string') continue;

      const ids = new Set<string>();
      for (const [slot, val] of Object.entries(reg)) {
        if (!Array.isArray(val)) continue;
        if (!/_models$/.test(slot)) continue;
        for (const entry of val as ModelEntry[]) {
          if (typeof entry?.id === 'string') ids.add(entry.id);
        }
      }

      const patterns: RegExp[] = [];
      for (const src of reg.id_patterns ?? []) {
        try { patterns.push(new RegExp(src, 'g')); } catch { /* skip malformed */ }
      }

      out.push({ vendor: reg.vendor, patterns, ids });
    } catch {
      // Malformed registry is surfaced by doctor's Vendor Registries section.
    }
  }
  return out;
}

const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.ai-dev-kit']);
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.some(ext => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function fileUsesRegistryModule(content: string): boolean {
  return /from\s+['"]@?\/lib\/registry['"]|from\s+['"]\.\.?\/registry['"]/.test(content) ||
    /\bvalidModels\s*\(/.test(content) ||
    /\bassertValidModel\s*\(/.test(content);
}

// ── Main ─────────────────────────────────────────────────────────────────

const registries = loadAllRegistries();

if (registries.length === 0) {
  process.stdout.write('Registry-string check: no registries in .ai-dev-kit/registries/, skipping.\n');
  process.stdout.write('  Add a registry for each vendor you call: `ai-dev-kit registry add <vendor>`.\n');
  process.exit(0);
}

const vendorsWithPatterns = registries.filter(r => r.patterns.length > 0);
if (vendorsWithPatterns.length === 0) {
  process.stdout.write(`Registry-string check: ${registries.length} registries loaded but none declare id_patterns, skipping literal scan.\n`);
  process.exit(0);
}

const sourceFiles = ['lib', 'app', 'components', 'src']
  .map(d => join(CWD, d))
  .flatMap(d => walk(d));

const hits: Array<{ file: string; line: number; match: string; vendor: string }> = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8');
  // Files that route through the registry module are exempt -- validation
  // happens at runtime instead.
  if (fileUsesRegistryModule(content)) continue;
  if (file.endsWith('lib/registry.ts')) continue;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const reg of vendorsWithPatterns) {
      for (const pattern of reg.patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null) {
          const id = match[0];
          // Only flag when the match is inside a string literal.
          const escaped = id.replace(/[.*+?^${}()|[\\]/g, '\\$&');
          const inString = new RegExp(`["'\`][^"'\`]*\\b${escaped}\\b[^"'\`]*["'\`]`).test(line);
          if (!inString) continue;

          if (!reg.ids.has(id)) {
            hits.push({
              file: relative(CWD, file),
              line: i + 1,
              match: id,
              vendor: reg.vendor,
            });
          }
        }
      }
    }
  }
}

if (hits.length > 0) {
  process.stderr.write('\nUnknown vendor model IDs detected (matched a registry\'s id_patterns but not in its model list):\n\n');
  for (const hit of hits) {
    process.stderr.write(`  ${hit.file}:${hit.line}  "${hit.match}"  (vendor: ${hit.vendor})\n`);
  }
  process.stderr.write('\nFix one of:\n');
  process.stderr.write('  - Add the model to the registry with provenance: `ai-dev-kit registry add-model <vendor> <id>`\n');
  process.stderr.write('  - Route through `validModels()` / `assertValidModel()` from @/lib/registry\n');
  process.stderr.write('  - If the literal is intentional and not a model id, narrow the registry\'s id_patterns\n\n');
  process.exit(1);
}

const totalIds = registries.reduce((s, r) => s + r.ids.size, 0);
process.stdout.write(`Registry-string check: ${sourceFiles.length} files scanned, ${registries.length} registries (${totalIds} IDs), 0 unknowns.\n`);
