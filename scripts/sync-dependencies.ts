#!/usr/bin/env tsx
/**
 * sync-dependencies -- read package.json + run pnpm audit, write
 * .ai-dev-kit/registries/dependencies.yaml. Cross-references vendor
 * registries when dep names match.
 *
 * Weekly GitHub Action regenerates. Pre-push check blocks on CRITICAL/HIGH.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const OUT = join(CWD, '.ai-dev-kit', 'registries', 'dependencies.yaml');
const REG_DIR = join(CWD, '.ai-dev-kit', 'registries');

interface Vuln {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  patched_in: string | null;
  reported_on: string | null;
  url: string | null;
}
interface Entry {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  vendor_registry: string | null;
  license: string | null;
  vulnerabilities: Vuln[];
  used_by: string[];
}

function readPkg(): { deps: Record<string, string>; dev: Record<string, string>; peer: Record<string, string> } {
  const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
  return {
    deps: (pkg.dependencies ?? {}) as Record<string, string>,
    dev: (pkg.devDependencies ?? {}) as Record<string, string>,
    peer: (pkg.peerDependencies ?? {}) as Record<string, string>,
  };
}

function runAudit(): Record<string, Vuln[]> {
  const out: Record<string, Vuln[]> = {};
  try {
    const raw = execSync('pnpm audit --json', { cwd: CWD, encoding: 'utf-8', stdio: 'pipe' });
    const parsed = JSON.parse(raw);
    const advisories = parsed.advisories || parsed.vulnerabilities || {};
    for (const [key, v] of Object.entries(advisories as Record<string, unknown>)) {
      const adv = v as Record<string, unknown>;
      const name = String(adv.module_name ?? adv.name ?? key);
      const sev = String(adv.severity ?? 'MEDIUM').toUpperCase() as Vuln['severity'];
      const entry: Vuln = {
        id: String(adv.id ?? adv.cves?.[0] ?? key),
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(sev) ? sev : 'MEDIUM',
        patched_in: typeof adv.patched_versions === 'string' ? adv.patched_versions : null,
        reported_on: typeof adv.created === 'string' ? adv.created : null,
        url: typeof adv.url === 'string' ? adv.url : null,
      };
      if (!out[name]) out[name] = [];
      out[name].push(entry);
    }
  } catch (err) {
    const msg = (err as { stdout?: string; message?: string }).stdout ?? (err as Error).message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.advisories) {
        for (const [key, v] of Object.entries(parsed.advisories as Record<string, unknown>)) {
          const adv = v as Record<string, unknown>;
          const name = String(adv.module_name ?? adv.name ?? key);
          const sev = String(adv.severity ?? 'MEDIUM').toUpperCase() as Vuln['severity'];
          (out[name] = out[name] || []).push({
            id: String(adv.id ?? key),
            severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(sev) ? sev : 'MEDIUM',
            patched_in: typeof adv.patched_versions === 'string' ? adv.patched_versions : null,
            reported_on: typeof adv.created === 'string' ? adv.created : null,
            url: typeof adv.url === 'string' ? adv.url : null,
          });
        }
      }
    } catch {
      console.warn('[sync-dependencies] pnpm audit unavailable or unparseable; proceeding with empty vuln list');
    }
  }
  return out;
}

function vendorRegistryFor(name: string): string | null {
  if (!existsSync(REG_DIR)) return null;
  for (const file of readdirSync(REG_DIR)) {
    if (!file.endsWith('.json') || file === 'registry.schema.json') continue;
    try {
      const parsed = JSON.parse(readFileSync(join(REG_DIR, file), 'utf-8'));
      if (typeof parsed.vendor === 'string' && (parsed.vendor === name || name.includes(parsed.vendor))) {
        return `.ai-dev-kit/registries/${file}`;
      }
    } catch { /* skip */ }
  }
  return null;
}

function usedBy(name: string): string[] {
  const paths = ['lib', 'app', 'components', 'src', 'pages'];
  const hits = new Set<string>();
  for (const base of paths) {
    const dir = join(CWD, base);
    if (!existsSync(dir)) continue;
    try {
      const out = execSync(
        `grep -rl ${JSON.stringify(`from '${name}'`)} ${JSON.stringify(dir)} || true; grep -rl ${JSON.stringify(`from "${name}"`)} ${JSON.stringify(dir)} || true`,
        { cwd: CWD, encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 },
      );
      for (const f of out.split('\n')) if (f.trim()) hits.add(f.replace(CWD + '/', ''));
    } catch { /* skip */ }
  }
  return [...hits].slice(0, 20);
}

const { deps, dev, peer } = readPkg();
const vulns = runAudit();
const entries: Entry[] = [];
const summary = { runtime: 0, dev: 0, critical: 0, high: 0, medium: 0, low: 0 };

function build(pkgMap: Record<string, string>, type: Entry['type']) {
  for (const [name, version] of Object.entries(pkgMap)) {
    const entry: Entry = {
      name,
      version,
      type,
      vendor_registry: vendorRegistryFor(name),
      license: null,
      vulnerabilities: vulns[name] ?? [],
      used_by: usedBy(name),
    };
    if (type === 'runtime') summary.runtime++;
    if (type === 'dev') summary.dev++;
    for (const v of entry.vulnerabilities) {
      if (v.severity === 'CRITICAL') summary.critical++;
      else if (v.severity === 'HIGH') summary.high++;
      else if (v.severity === 'MEDIUM') summary.medium++;
      else if (v.severity === 'LOW') summary.low++;
    }
    entries.push(entry);
  }
}

build(deps, 'runtime');
build(dev, 'dev');
build(peer, 'peer');

const lines: string[] = [];
lines.push('kind: dependencies');
lines.push('schema_version: 1');
lines.push(`last_audited_on: "${new Date().toISOString()}"`);
lines.push('entries:');
for (const e of entries) {
  lines.push(`  - name: ${e.name}`);
  lines.push(`    version: ${JSON.stringify(e.version)}`);
  lines.push(`    type: ${e.type}`);
  lines.push(`    vendor_registry: ${e.vendor_registry ?? 'null'}`);
  lines.push(`    license: ${e.license ?? 'null'}`);
  lines.push(`    vulnerabilities: [${e.vulnerabilities.map(v => `{id: ${JSON.stringify(v.id)}, severity: ${v.severity}, patched_in: ${JSON.stringify(v.patched_in)}, url: ${JSON.stringify(v.url)}}`).join(', ')}]`);
  lines.push(`    used_by: [${e.used_by.map(p => JSON.stringify(p)).join(', ')}]`);
}
lines.push('summary:');
lines.push(`  runtime: ${summary.runtime}`);
lines.push(`  dev: ${summary.dev}`);
lines.push(`  critical: ${summary.critical}`);
lines.push(`  high: ${summary.high}`);
lines.push(`  medium: ${summary.medium}`);
lines.push(`  low: ${summary.low}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`[sync-dependencies] ${entries.length} packages · ${summary.critical} CRITICAL · ${summary.high} HIGH · ${summary.medium} MEDIUM · ${summary.low} LOW`);
