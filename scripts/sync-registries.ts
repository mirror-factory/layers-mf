#!/usr/bin/env tsx
/**
 * sync-registries -- scan the codebase and refresh the auto-populated
 * registries: components, pages, tools, skills.
 *
 * Invocation:
 *   - pre-commit (pre-registry-strings step)
 *   - `ai-dev-kit onboard` (once per install)
 *   - standalone: `npx tsx scripts/sync-registries.ts`
 *
 * Policy:
 *   * Never deletes hand-edited fields on entries (owner, status, auth, etc.).
 *     New fields are merged in; removed source files mark the entry with
 *     `removed_on: <iso>` instead of deleting so the registry is an
 *     append-only source of truth.
 *   * Writes atomically (tmp + rename) so a crashed sync never corrupts.
 *   * Emits ZERO stdout on no-op; single-line summary when something changes.
 *   * Exits 0 always. The pre-commit gate's job is to check doctor (which
 *     verifies freshness), not to block on a sync error.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const CWD = process.cwd();
const REG_DIR = join(CWD, '.ai-dev-kit', 'registries');
const NOW = new Date().toISOString();

interface RegistryFile {
  kind: string;
  schema_version: number;
  last_synced_on: string | null;
  entries: Array<Record<string, unknown>>;
}

function readRegistry(name: string): RegistryFile {
  const path = join(REG_DIR, `${name}.yaml`);
  if (!existsSync(path)) {
    return { kind: name, schema_version: 1, last_synced_on: null, entries: [] };
  }
  const src = readFileSync(path, 'utf-8');
  return parseSimpleRegistry(src, name);
}

function writeRegistry(name: string, reg: RegistryFile): void {
  const path = join(REG_DIR, `${name}.yaml`);
  const tmp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, renderRegistry(reg));
  renameSync(tmp, path);
}

function parseSimpleRegistry(src: string, fallbackKind: string): RegistryFile {
  const lines = src.split('\n');
  const out: RegistryFile = {
    kind: fallbackKind,
    schema_version: 1,
    last_synced_on: null,
    entries: [],
  };

  let inEntries = false;
  let current: Record<string, unknown> | null = null;

  const commit = () => {
    if (current && Object.keys(current).length > 0) out.entries.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!inEntries) {
      const k = line.match(/^kind:\s*(.+)$/);
      if (k) { out.kind = k[1].trim(); continue; }
      const v = line.match(/^schema_version:\s*(\d+)$/);
      if (v) { out.schema_version = Number(v[1]); continue; }
      const s = line.match(/^last_synced_on:\s*(.+)$/);
      if (s) {
        const val = s[1].trim();
        out.last_synced_on = val === 'null' || val === '~' ? null : val.replace(/^["']|["']$/g, '');
        continue;
      }
      if (/^entries:\s*(\[\]|)\s*$/.test(line)) {
        inEntries = true;
        continue;
      }
    } else {
      const itemStart = line.match(/^\s+-\s+([a-z_]+):\s*(.*)$/);
      if (itemStart) {
        commit();
        current = {};
        current[itemStart[1]] = coerceScalar(itemStart[2]);
        continue;
      }
      const kv = line.match(/^\s+([a-z_]+):\s*(.*)$/);
      if (kv && current) {
        current[kv[1]] = coerceScalar(kv[2]);
      }
    }
  }
  commit();
  return out;
}

function coerceScalar(raw: string): unknown {
  const v = raw.trim().replace(/^["']|["']$/g, '');
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function renderRegistry(reg: RegistryFile): string {
  const lines: string[] = [];
  lines.push(`kind: ${reg.kind}`);
  lines.push(`schema_version: ${reg.schema_version}`);
  lines.push(`last_synced_on: ${reg.last_synced_on ?? 'null'}`);
  if (reg.entries.length === 0) {
    lines.push('entries: []');
  } else {
    lines.push('entries:');
    for (const e of reg.entries) {
      const keys = Object.keys(e);
      if (keys.length === 0) continue;
      lines.push(`  - ${keys[0]}: ${formatValue(e[keys[0]])}`);
      for (let i = 1; i < keys.length; i++) {
        lines.push(`    ${keys[i]}: ${formatValue(e[keys[i]])}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  if (/[:#\[\]{}&*!|>'"%@`]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

// ── Scanners ───────────────────────────────────────────────────────────

function walk(dir: string, ext: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.turbo' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, ext, out);
    else if (ext.some(e => full.endsWith(e))) out.push(full);
  }
  return out;
}

function scanComponents(): Array<Record<string, unknown>> {
  const dirs = ['components', 'src/components', 'app/components'];
  const out: Array<Record<string, unknown>> = [];
  for (const d of dirs) {
    const abs = join(CWD, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, ['.tsx', '.jsx'])) {
      if (file.endsWith('.test.tsx') || file.endsWith('.stories.tsx') || file.endsWith('.spec.tsx')) continue;
      const rel = relative(CWD, file);
      const name = rel.split('/').pop()!.replace(/\.(tsx|jsx)$/, '');
      const storyPath = file.replace(/\.(tsx|jsx)$/, '.stories.$1');
      const visualPath = join('tests/visual', `${name}.spec.ts`);
      out.push({
        name,
        path: rel,
        stories_path: existsSync(storyPath) ? relative(CWD, storyPath) : null,
        visual_path: existsSync(join(CWD, visualPath)) ? visualPath : null,
        owner: null,
        status: 'stable',
      });
    }
  }
  return out;
}

function scanPages(): Array<Record<string, unknown>> {
  const roots = ['app', 'src/app'];
  const out: Array<Record<string, unknown>> = [];
  for (const r of roots) {
    const abs = join(CWD, r);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, ['.tsx'])) {
      if (!/\/page\.tsx$/.test(file)) continue;
      const rel = relative(CWD, file);
      // "app/dev-kit/runs/[id]/page.tsx" -> "/dev-kit/runs/[id]"
      const routePath = rel
        .replace(/^(src\/)?app\//, '')
        .replace(/(^|\/)page\.tsx$/, '');
      const route = ('/' + routePath)
        // Next App Router route groups like `(dashboard)` are filesystem-only
        // and must not appear in browser URLs or Expect/Playwright targets.
        .replace(/\/\([^/]+\)/g, '')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '') || '/';
      out.push({
        route,
        path: rel,
        owner: null,
        auth: 'public',
        features: [],
      });
    }
  }
  return out;
}

// 0.2.14: API route scanner -- walks app/**/route.ts(x) and extracts the
// exported HTTP methods. Populates api-routes.yaml. This closes the gap
// where /api/chat, /api/transcribe etc. had zero visibility in the
// registry ecosystem (llms.txt:27 references it but it did not exist).
function scanApiRoutes(): Array<Record<string, unknown>> {
  const roots = ['app', 'src/app'];
  const out: Array<Record<string, unknown>> = [];
  for (const r of roots) {
    const abs = join(CWD, r);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, ['.ts', '.tsx'])) {
      if (!/\/route\.(ts|tsx)$/.test(file)) continue;
      const rel = relative(CWD, file);
      // "app/api/chat/route.ts" -> "/api/chat"
      const route = '/' + rel.replace(/^(src\/)?app\//, '').replace(/\/route\.(ts|tsx)$/, '').replace(/^$/, '');
      const src = readFileSync(file, 'utf-8');
      const methods: string[] = [];
      for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']) {
        const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\s*=`);
        if (re.test(src)) methods.push(m);
      }
      if (methods.length === 0) continue;
      for (const method of methods) {
        out.push({
          // Composite key: one entry per (route, method) pair. The merge
          // helper dedupes on a single key field, so we synthesize `id`
          // as "METHOD ROUTE" (e.g., "POST /api/chat").
          id: `${method} ${route}`,
          route,
          method,
          path: rel,
          owner: null,
          auth: 'public',
          description: null,
        });
      }
    }
  }
  return out;
}

function scanTools(): Array<Record<string, unknown>> {
  const dirs = ['lib/ai/tools', 'src/lib/ai/tools'];
  const out: Array<Record<string, unknown>> = [];
  for (const d of dirs) {
    const abs = join(CWD, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, ['.ts'])) {
      if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) continue;
      const rel = relative(CWD, file);
      const src = readFileSync(file, 'utf-8');
      const nameMatch = src.match(/export\s+const\s+(\w+)\s*=\s*tool\(/);
      const descMatch = src.match(/description:\s*['"`]([^'"`]+)['"`]/);
      const hasTest = existsSync(file.replace(/\.ts$/, '.test.ts'));
      out.push({
        name: nameMatch?.[1] ?? rel.split('/').pop()!.replace(/\.ts$/, ''),
        path: rel,
        description: descMatch?.[1] ?? null,
        has_test: hasTest,
        owner: null,
      });
    }
  }
  return out;
}

// 0.2.14: bring MCP servers into the YAML registry ecosystem. Claude
// Code's source of truth stays `.mcp.json`; we mirror it into yaml so
// the dashboard and doctor have the same data shape as every other
// registry. required_env is extracted from the args/env block so doctor
// can warn when a required key is empty.
function scanMcpServers(): Array<Record<string, unknown>> {
  const path = join(CWD, '.mcp.json');
  if (!existsSync(path)) return [];
  let raw: string;
  try { raw = readFileSync(path, 'utf-8'); } catch { return []; }
  let data: { mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }> };
  try { data = JSON.parse(raw); } catch { return []; }
  const servers = data.mcpServers ?? {};
  const out: Array<Record<string, unknown>> = [];
  for (const [name, cfg] of Object.entries(servers)) {
    const requiredEnv: string[] = [];
    for (const [k, v] of Object.entries(cfg.env ?? {})) {
      const m = String(v).match(/\$\{([^}]+)\}/);
      if (m) requiredEnv.push(m[1]);
      else if (v === '' || v == null) requiredEnv.push(k);
    }
    out.push({
      name,
      command: cfg.command ?? '',
      args: JSON.stringify(cfg.args ?? []),
      required_env: JSON.stringify(requiredEnv),
      used_by: '[]',
      description: null,
    });
  }
  return out;
}

function scanSkills(): Array<Record<string, unknown>> {
  const dirs = ['.claude/skills'];
  const out: Array<Record<string, unknown>> = [];

  // Read invocation rollups.
  const invFile = join(CWD, '.ai-dev-kit', 'state', 'skill-invocations.jsonl');
  const rollup: Record<string, { count: number; last_ts: string; last_run_id: string | null }> = {};
  if (existsSync(invFile)) {
    for (const line of readFileSync(invFile, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as { skill: string; ts: string; run_id: string | null };
        const cur = rollup[r.skill] ?? { count: 0, last_ts: '', last_run_id: null };
        cur.count += 1;
        if (r.ts > cur.last_ts) {
          cur.last_ts = r.ts;
          cur.last_run_id = r.run_id;
        }
        rollup[r.skill] = cur;
      } catch { /* skip malformed lines */ }
    }
  }

  for (const d of dirs) {
    const abs = join(CWD, d);
    if (!existsSync(abs)) continue;
    for (const skill of readdirSync(abs)) {
      const skillPath = join(abs, skill, 'SKILL.md');
      if (!existsSync(skillPath)) continue;
      const src = readFileSync(skillPath, 'utf-8');
      const descMatch = src.match(/^description:\s*(.+)$/m);
      const r = rollup[skill] ?? { count: 0, last_ts: '', last_run_id: null };
      out.push({
        name: skill,
        path: relative(CWD, skillPath),
        description: descMatch?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null,
        invocation_count: r.count,
        last_invoked_at: r.last_ts || null,
        last_run_id: r.last_run_id,
      });
    }
  }
  return out;
}

// 0.2.19: hooks registry -- unifies husky git hooks and Claude Code hooks
// into a single registry so doctor can answer "every hook present AND
// wired". Husky hooks fire via `core.hooksPath`; claude hooks fire via
// `.claude/settings.json` entries. Both surfaces are expected to emit
// kit-audit spans, which is what `kit_audit_instrumented` verifies.
function scanHooks(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  // Husky -----------------------------------------------------------------
  const huskyDir = join(CWD, '.husky');
  if (existsSync(huskyDir)) {
    let entries: string[] = [];
    try { entries = readdirSync(huskyDir); } catch { entries = []; }
    for (const entry of entries) {
      if (entry.startsWith('.') || entry.startsWith('_')) continue;
      const full = join(huskyDir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (!st.isFile()) continue;
      let content = '';
      let mtime = st.mtime.toISOString();
      try { content = readFileSync(full, 'utf-8'); } catch { content = ''; }
      const instrumented = /\b(logKitEvent|log_kit_event|kit_audit_step|kit_audit_hook_start|kit-audit)\b/.test(content);
      out.push({
        name: entry,
        surface: 'husky',
        event: entry,
        path: relative(CWD, full),
        wired_in_settings: true,
        kit_audit_instrumented: instrumented,
        tool_filter: null,
        last_modified: mtime,
      });
    }
  }

  // Claude ----------------------------------------------------------------
  const claudeHooksDir = join(CWD, '.claude', 'hooks');
  const settingsPath = join(CWD, '.claude', 'settings.json');

  // Build filename -> { event, matcher } map from settings.json.
  const settingsMap = new Map<string, { event: string; matcher: string | null }>();
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf-8');
      const data = JSON.parse(raw) as {
        hooks?: Record<string, Array<
          | { matcher?: string; hooks?: Array<{ type?: string; command?: string }> }
          | { type?: string; command?: string }
        >>;
      };
      const hooksBlock = data.hooks ?? {};
      for (const [event, arr] of Object.entries(hooksBlock)) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          // Two shapes: {matcher, hooks:[...]} or {type,command}.
          if (item && typeof item === 'object' && 'hooks' in item && Array.isArray((item as { hooks?: unknown }).hooks)) {
            const matcher = (item as { matcher?: string }).matcher ?? null;
            for (const h of (item as { hooks: Array<{ command?: string }> }).hooks) {
              const cmd = h?.command;
              if (typeof cmd !== 'string') continue;
              const m = cmd.match(/\.claude\/hooks\/([^\s]+)/);
              if (m && !settingsMap.has(m[1])) {
                settingsMap.set(m[1], { event, matcher });
              }
            }
          } else if (item && typeof item === 'object' && 'command' in item) {
            const cmd = (item as { command?: string }).command;
            if (typeof cmd !== 'string') continue;
            const m = cmd.match(/\.claude\/hooks\/([^\s]+)/);
            if (m && !settingsMap.has(m[1])) {
              settingsMap.set(m[1], { event, matcher: null });
            }
          }
        }
      }
    } catch { /* malformed settings.json -- treat as empty */ }
  }

  if (existsSync(claudeHooksDir)) {
    let entries: string[] = [];
    try { entries = readdirSync(claudeHooksDir); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.endsWith('.py')) continue;
      if (entry.startsWith('.') || entry.startsWith('_')) continue;
      const full = join(claudeHooksDir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (!st.isFile()) continue;
      let content = '';
      try { content = readFileSync(full, 'utf-8'); } catch { content = ''; }
      const instrumented = /\b(log_kit_event|record_kit_event|logKitEvent|kit_audit_step|kit_audit_hook_start)\b/.test(content);
      const wiring = settingsMap.get(entry);
      out.push({
        name: entry,
        surface: 'claude',
        event: wiring?.event ?? null,
        path: relative(CWD, full),
        wired_in_settings: wiring != null,
        kit_audit_instrumented: instrumented,
        tool_filter: wiring?.matcher ?? null,
        last_modified: st.mtime.toISOString(),
      });
    }
  }

  return out;
}

// 0.2.19: docs registry -- tracks every markdown under docs/, annotated
// with category, word count, and inbound/outbound link health so doctor
// can flag orphans and broken refs without grep.
function scanDocs(): Array<Record<string, unknown>> {
  const docsDir = join(CWD, 'docs');
  const readmePath = join(CWD, 'README.md');
  if (!existsSync(docsDir)) return [];

  // Collect every doc .md (absolute path) plus the repo-root README.
  const docFiles: string[] = [];
  try {
    for (const f of walk(docsDir, ['.md'])) docFiles.push(f);
  } catch { /* treat as empty */ }
  const sourcesForInbound = [...docFiles];
  if (existsSync(readmePath)) sourcesForInbound.push(readmePath);

  // Pass 1: build inbound link counts keyed by absolute resolved path.
  const inbound = new Map<string, number>();
  const linkRe = /\]\((\.\.?\/[^)\s]+\.md)\)/g;
  for (const src of sourcesForInbound) {
    let content = '';
    try { content = readFileSync(src, 'utf-8'); } catch { continue; }
    const srcDir = dirname(src);
    let match: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((match = linkRe.exec(content)) !== null) {
      try {
        const resolved = join(srcDir, match[1]);
        inbound.set(resolved, (inbound.get(resolved) ?? 0) + 1);
      } catch { /* skip unresolvable */ }
    }
  }

  // Pass 2: emit one entry per doc file.
  const out: Array<Record<string, unknown>> = [];
  for (const file of docFiles) {
    let content = '';
    let st;
    try {
      content = readFileSync(file, 'utf-8');
      st = statSync(file);
    } catch { continue; }
    const rel = relative(CWD, file);
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Category: second path segment, "root" for top-level docs/*.md.
    const parts = rel.split('/');
    let category = 'root';
    if (parts.length >= 3 && parts[0] === 'docs') category = parts[1];

    // Outbound broken: count relative .md links that don't resolve.
    let broken = 0;
    const dir = dirname(file);
    let m: RegExpExecArray | null;
    const re = /\]\((\.\.?\/[^)\s]+\.md)\)/g;
    while ((m = re.exec(content)) !== null) {
      try {
        const resolved = join(dir, m[1]);
        if (!existsSync(resolved)) broken += 1;
      } catch { broken += 1; }
    }

    out.push({
      path: rel,
      category,
      word_count: wordCount,
      inbound_links: inbound.get(file) ?? 0,
      outbound_links_broken: broken,
      last_modified: st.mtime.toISOString(),
    });
  }
  return out;
}

// 0.2.19: tests registry -- inventories every test file and joins it to
// the feature that owns it via features/<name>/TEST-MANIFEST.yaml.
// 0.2.20: run telemetry -- `last_run`, `last_duration_ms`, `last_outcome`
// now populated from `.ai-dev-kit/state/test-runs.jsonl` (appended by the
// vitest/playwright kit reporters). Newest-ts entry per test_file wins,
// mirroring the skill-invocations rollup above.
function scanTests(): Array<Record<string, unknown>> {
  // Build featureMap from features/<name>/TEST-MANIFEST.yaml.
  const featureMap = new Map<string, string>();
  const featuresDir = join(CWD, 'features');
  if (existsSync(featuresDir)) {
    let names: string[] = [];
    try { names = readdirSync(featuresDir); } catch { names = []; }
    for (const name of names) {
      if (name.startsWith('.') || name.startsWith('_')) continue;
      const manifestPath = join(featuresDir, name, 'TEST-MANIFEST.yaml');
      if (!existsSync(manifestPath)) continue;
      let content = '';
      try { content = readFileSync(manifestPath, 'utf-8'); } catch { continue; }
      // Liberal regex -- allow quoted or unquoted values, any indentation.
      const re = /^\s*-?\s*test_file:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const p = m[1].trim();
        if (p) featureMap.set(p, name);
      }
    }
  }

  // Build runMap from .ai-dev-kit/state/test-runs.jsonl -- keep only the
  // newest entry per test_file (by ts string compare; ISO-8601 is
  // lexicographically sortable).
  const runMap = new Map<string, { ts: string; duration_ms: number | null; outcome: string | null }>();
  const runsFile = join(CWD, '.ai-dev-kit', 'state', 'test-runs.jsonl');
  if (existsSync(runsFile)) {
    let raw = '';
    try { raw = readFileSync(runsFile, 'utf-8'); } catch { raw = ''; }
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as {
          ts?: string;
          test_file?: string;
          outcome?: string;
          duration_ms?: number;
        };
        if (!r.ts || !r.test_file) continue;
        const prev = runMap.get(r.test_file);
        if (!prev || r.ts > prev.ts) {
          runMap.set(r.test_file, {
            ts: r.ts,
            duration_ms: typeof r.duration_ms === 'number' ? r.duration_ms : null,
            outcome: r.outcome ?? null,
          });
        }
      } catch { /* skip malformed lines */ }
    }
  }

  const exts = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.mjs', '.spec.mjs'];
  const out: Array<Record<string, unknown>> = [];
  for (const d of ['tests', 'src/tests']) {
    const abs = join(CWD, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, exts)) {
      let st;
      try { st = statSync(file); } catch { continue; }
      const rel = relative(CWD, file);
      const run = runMap.get(rel);
      out.push({
        path: rel,
        feature: featureMap.get(rel) ?? null,
        last_modified: st.mtime.toISOString(),
        last_run: run?.ts ?? null,
        last_duration_ms: run?.duration_ms ?? null,
        last_outcome: run?.outcome ?? null,
      });
    }
  }
  return out;
}

// ── Auto-detect components for design-system.yaml ────────────────────
// Scans components/ directories for .tsx files and adds missing entries
// to design-system.yaml as primitives with minimal scaffolding. This
// closes the gap where a developer adds a component file but forgets
// to declare it in the design system spec.

function syncDesignSystemComponents(): boolean {
  const dsPath = join(REG_DIR, 'design-system.yaml');
  if (!existsSync(dsPath)) return false;

  const src = readFileSync(dsPath, 'utf-8');

  // Collect all component names already declared in design-system.yaml.
  // They appear as "  ComponentName:" under primitives/molecules/organisms/templates.
  const declaredNames = new Set<string>();
  for (const m of src.matchAll(/^\s{2}([A-Z][A-Za-z0-9]+):\s*$/gm)) {
    declaredNames.add(m[1]);
  }

  // Scan component directories for .tsx files.
  const dirs = ['components', 'src/components', 'app/components'];
  const newComponents: string[] = [];
  for (const d of dirs) {
    const abs = join(CWD, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs, ['.tsx', '.jsx'])) {
      if (file.endsWith('.test.tsx') || file.endsWith('.stories.tsx') || file.endsWith('.spec.tsx')) continue;
      const basename = file.split('/').pop()!.replace(/\.(tsx|jsx)$/, '');
      // Only consider PascalCase names (React components).
      if (!/^[A-Z]/.test(basename)) continue;
      if (!declaredNames.has(basename)) {
        newComponents.push(basename);
      }
    }
  }

  if (newComponents.length === 0) return false;

  // Append new components under the primitives section.
  // Find the end of the primitives block (before molecules or end of file).
  const insertMarkers = ['# ─── Molecules', 'molecules:', '# ─── Organisms', 'organisms:'];
  let insertIdx = -1;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const marker of insertMarkers) {
      if (lines[i].includes(marker)) {
        insertIdx = i;
        break;
      }
    }
    if (insertIdx >= 0) break;
  }

  const newEntries: string[] = [];
  for (const name of newComponents) {
    newEntries.push('');
    newEntries.push(`  ${name}:`);
    newEntries.push(`    purpose: "Auto-detected from components/. Add a description."`);
    newEntries.push(`    variants: []`);
    newEntries.push(`    states: [default]`);
  }

  if (insertIdx >= 0) {
    lines.splice(insertIdx, 0, ...newEntries);
  } else {
    // No marker found, append at end.
    lines.push(...newEntries);
  }

  const tmp = `${dsPath}.tmp`;
  writeFileSync(tmp, lines.join('\n'));
  renameSync(tmp, dsPath);
  return true;
}

// ── Merge helper: preserve hand-edited fields ──────────────────────────

function mergeEntries(
  existing: Array<Record<string, unknown>>,
  scanned: Array<Record<string, unknown>>,
  keyField: string,
): Array<Record<string, unknown>> {
  const byKey = new Map(existing.map(e => [e[keyField] as string, e]));
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const s of scanned) {
    const key = s[keyField] as string;
    seen.add(key);
    const prior = byKey.get(key);
    if (!prior) {
      out.push({ ...s, created_on: NOW });
    } else {
      // Scanned fields win for auto-populated keys; prior wins for
      // hand-editable keys (owner, status, auth, notes).
      const HAND_EDIT = new Set(['owner', 'status', 'auth', 'notes']);
      const merged: Record<string, unknown> = { ...s };
      for (const [pk, pv] of Object.entries(prior)) {
        if (HAND_EDIT.has(pk) && pv != null && pv !== '') merged[pk] = pv;
        if (pk === 'created_on' && pv) merged.created_on = pv;
      }
      out.push(merged);
    }
  }

  // Preserve removed entries with a removed_on marker.
  for (const e of existing) {
    const key = e[keyField] as string;
    if (!seen.has(key) && !e.removed_on) {
      out.push({ ...e, removed_on: NOW });
    } else if (!seen.has(key)) {
      out.push(e);
    }
  }

  return out;
}

// ── Main ───────────────────────────────────────────────────────────────

function sync(name: string, keyField: string, scanner: () => Array<Record<string, unknown>>): boolean {
  const existing = readRegistry(name);
  const scanned = scanner();
  const merged = mergeEntries(existing.entries, scanned, keyField);

  const before = JSON.stringify(existing.entries);
  const after = JSON.stringify(merged);
  if (before === after) return false;

  existing.entries = merged;
  existing.last_synced_on = NOW;
  writeRegistry(name, existing);
  return true;
}

const changed: string[] = [];
if (sync('components', 'path', scanComponents)) changed.push('components');
if (sync('pages', 'route', scanPages)) changed.push('pages');
if (sync('api-routes', 'id', scanApiRoutes)) changed.push('api-routes');
if (sync('tools', 'path', scanTools)) changed.push('tools');
if (sync('skills', 'name', scanSkills)) changed.push('skills');
if (sync('mcp-servers', 'name', scanMcpServers)) changed.push('mcp-servers');
if (sync('hooks', 'path', scanHooks)) changed.push('hooks');
if (sync('docs', 'path', scanDocs)) changed.push('docs');
if (sync('tests', 'path', scanTests)) changed.push('tests');

// Auto-detect components not yet declared in design-system.yaml.
if (syncDesignSystemComponents()) changed.push('design-system');

// Auto-scaffold a visual regression spec for every component that doesn't
// have one yet. Policy: never overwrite. The scaffold is a minimal
// toHaveScreenshot per-project spec; authors extend as needed.
const componentsReg = readRegistry('components');
for (const entry of componentsReg.entries) {
  const name = entry.name as string | undefined;
  const path = entry.path as string | undefined;
  if (!name || !path) continue;
  if (entry.removed_on) continue;
  const visualSpecPath = join(CWD, 'tests', 'visual', `${name}.spec.ts`);
  if (existsSync(visualSpecPath)) continue;

  const body = `/**
 * Auto-scaffolded by sync-registries.ts for ${name}.
 *
 * Runs across the 6-project matrix (mobile/tablet/desktop x light/dark)
 * from playwright.config.ts. Starts NOT-skipped (as of 0.2.8) so the
 * baseline either exists or the push fails loud.
 *
 * First run on this component: the test will fail because no baseline PNG
 * is committed yet. Create the baselines with:
 *
 *   VISUAL_UPDATE=1 pnpm exec playwright test tests/visual/${name}.spec.ts
 *
 * Commit the generated PNGs alongside this spec. Subsequent pushes compare
 * against them with maxDiffPixelRatio 0.01.
 *
 * Extend: replace the \`/\` route with a Storybook URL or a dedicated test
 * page, add interaction states (hover/focus/loading), mock props as needed.
 */
import { test, expect } from '@playwright/test';

test.describe('visual: ${name}', () => {
  test('matches baseline', async ({ page }, testInfo) => {
    // TODO: point at a Storybook URL / dedicated test page rendering ${name}.
    await page.goto('/');
    await expect(page).toHaveScreenshot(
      \`${name}-\${testInfo.project.name}.png\`,
      { animations: 'disabled', maxDiffPixelRatio: 0.01 },
    );
  });
});
`;
  try {
    mkdirSync(join(CWD, 'tests', 'visual'), { recursive: true });
    writeFileSync(visualSpecPath, body);
    changed.push(`visual-spec:${name}`);
  } catch { /* non-fatal */ }
}

if (changed.length > 0) {
  console.log(`[sync-registries] refreshed: ${changed.join(', ')}`);
}
