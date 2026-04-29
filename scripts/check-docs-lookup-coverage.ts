#!/usr/bin/env tsx
/**
 * check-docs-lookup-coverage -- pre-push gate.
 *
 * Closes the bypass where a non-Claude-Code editor (git-only workflow,
 * Cursor with Context7 off, etc.) lets vendor code land without a docs
 * lookup. The PreToolUse hook only fires inside Claude Code; this script
 * fires on every push, regardless of editor.
 *
 * Logic:
 *   1. Enumerate files changed vs `origin/main` (or the target branch).
 *   2. Grep imports in changed .ts/.tsx files against the dynamic
 *      flagged-library list (package.json + registries).
 *   3. Read .ai-dev-kit/state/docs-lookups.jsonl for the current run_id.
 *   4. Fail if any flagged library was touched without a matching lookup.
 *
 * Bypass: CONTEXT7_SKIP=1 (logged as silent regression by audit-rebuild).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const STATE_FILE = join(CWD, '.ai-dev-kit', 'state', 'current-run.json');
const DOCS_LOG = join(CWD, '.ai-dev-kit', 'state', 'docs-lookups.jsonl');

if (process.env.CONTEXT7_SKIP === '1') {
  console.log('[check-docs-lookup-coverage] CONTEXT7_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

const DO_NOT_FLAG = new Set([
  'react', 'react-dom', 'next', 'typescript', 'node',
  '@types/node', '@types/react', '@types/react-dom',
  'eslint', 'prettier', 'vitest', '@playwright/test', 'playwright',
  'tailwindcss', 'postcss', 'autoprefixer', 'tsx', 'zod',
  'clsx', 'lucide-react', 'class-variance-authority',
]);

function loadFlagged(): Set<string> {
  const flagged = new Set<string>([
    'assemblyai', '@ai-sdk/', 'ai', 'langfuse', '@langfuse/',
    '@deepgram/sdk', '@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk',
    'openai', '@google/generative-ai',
  ]);

  // package.json deps
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      for (const dep of Object.keys(pkg[section] ?? {})) {
        if (DO_NOT_FLAG.has(dep) || dep.startsWith('@types/')) continue;
        flagged.add(dep);
      }
    }
  } catch { /* no package.json; skip */ }

  // registries
  const regDir = join(CWD, '.ai-dev-kit', 'registries');
  if (existsSync(regDir)) {
    try {
      const { readdirSync } = require('node:fs');
      for (const f of readdirSync(regDir)) {
        if (!f.endsWith('.json') || f === 'registry.schema.json') continue;
        try {
          const data = JSON.parse(readFileSync(join(regDir, f), 'utf-8'));
          if (typeof data.vendor === 'string') flagged.add(data.vendor);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return flagged;
}

function changedFiles(): string[] {
  try {
    // Diff vs upstream or origin/main as fallback
    let base: string;
    try {
      base = execSync('git rev-parse --abbrev-ref @{upstream}', { cwd: CWD, encoding: 'utf-8' }).trim();
    } catch {
      base = 'origin/main';
    }
    const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(f =>
      (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.mts')) &&
      !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') &&
      !f.endsWith('.spec.ts') && !f.endsWith('.spec.tsx') &&
      !f.startsWith('node_modules/') && !f.startsWith('scripts/') &&
      !f.startsWith('.ai-dev-kit/'),
    );
  } catch {
    return [];
  }
}

const IMPORT_RE = /from\s+['"`]([^'"`]+)['"`]/g;

function importsInFile(path: string): string[] {
  const full = join(CWD, path);
  if (!existsSync(full)) return [];
  const src = readFileSync(full, 'utf-8');
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(src)) !== null) out.add(m[1]);
  return [...out];
}

function matchesFlagged(imp: string, flagged: Set<string>): string | null {
  for (const f of flagged) {
    if (imp === f || imp.startsWith(f) || imp.startsWith(f + '/')) return f;
  }
  return null;
}

function currentRunId(): string | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')).run_id ?? null;
  } catch {
    return null;
  }
}

function librariesLookedUp(runId: string | null): Set<string> {
  const out = new Set<string>();
  if (!existsSync(DOCS_LOG)) return out;
  for (const line of readFileSync(DOCS_LOG, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // If we have a run_id, filter to it. Otherwise accept any recent lookup.
      if (runId && r.run_id !== runId) continue;
      const libs = Array.isArray(r.libraries) ? r.libraries : [];
      for (const lib of libs) if (typeof lib === 'string') out.add(lib);
    } catch { /* skip */ }
  }
  return out;
}

const flagged = loadFlagged();
const changed = changedFiles();

const touched = new Set<string>();
for (const path of changed) {
  for (const imp of importsInFile(path)) {
    const hit = matchesFlagged(imp, flagged);
    if (hit) touched.add(hit);
  }
}

if (touched.size === 0) {
  console.log('[check-docs-lookup-coverage] no flagged libraries touched; skipping.');
  process.exit(0);
}

const looked = librariesLookedUp(currentRunId());
const missing = [...touched].filter(lib => {
  // Accept a lookup for the library itself OR any superstring match
  // (e.g. 'openai' counts for 'openai' + '@openai/something').
  for (const l of looked) {
    if (l === lib || l.startsWith(lib) || lib.startsWith(l)) return false;
  }
  return true;
});

if (missing.length === 0) {
  console.log(`[check-docs-lookup-coverage] OK: all ${touched.size} flagged libraries had a docs lookup this run.`);
  process.exit(0);
}

console.error('\n[check-docs-lookup-coverage] BLOCKED: flagged libraries touched without a fresh Context7 lookup this run.');
console.error('');
console.error('Missing lookups:');
for (const m of missing) console.error('  ' + m);
console.error('');
console.error('Fix (pick one per library):');
console.error('  1. In Claude Code: invoke mcp__context7__resolve-library-id + get-library-docs on each above');
console.error('  2. WebFetch the vendor docs URL directly');
console.error('  3. If the lookup happened in a PRIOR run, re-run now to tag it with the current run_id');
console.error('');
console.error('Bypass (logged as silent regression):');
console.error('  CONTEXT7_SKIP=1 git push ...');
console.error('');
process.exit(1);
