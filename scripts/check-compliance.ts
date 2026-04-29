#!/usr/bin/env tsx
/**
 * Compliance Checker — Enforces starter kit patterns
 *
 * Run: `pnpm compliance` or `tsx scripts/check-compliance.ts`
 *
 * This is the single most important script in the starter kit.
 * It turns documentation into enforcement. Every pattern that's
 * documented but not checked will eventually be skipped under
 * time pressure. This script makes skipping impossible.
 *
 * Exit code 0 = all checks pass, 1 = at least one failure.
 * Designed to run in pre-push hooks and CI.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ── Types ─────────────────────────────────────────────────────────────

interface CheckResult {
  pass: boolean;
  message: string;
  files?: string[];
  severity: 'error' | 'warning';
}

interface Check {
  name: string;
  description: string;
  check: () => CheckResult;
}

// ── Helpers ───────────────────────────────────────────────────────────

function glob(pattern: string, dir: string = '.'): string[] {
  const results: string[] = [];
  // Extract extension and optional prefix from pattern like "**/smoke*.spec.ts" or "**/*.ts"
  const lastSlash = pattern.lastIndexOf('/');
  const filePattern = lastSlash >= 0 ? pattern.slice(lastSlash + 1) : pattern;
  const hasPrefix = !filePattern.startsWith('*') || (filePattern.startsWith('*') && filePattern[1] !== '*' && filePattern[1] !== '.');
  const prefix = hasPrefix ? filePattern.split('*')[0] : ''; // "smoke" from "smoke*.spec.ts"
  const suffix = filePattern.includes('*') ? filePattern.split('*').pop()! : filePattern; // ".spec.ts"

  function walk(d: string) {
    if (!existsSync(d)) return;
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(suffix) && (!prefix || entry.name.startsWith(prefix))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function fileContains(filePath: string, search: string): boolean {
  if (!existsSync(filePath)) return false;
  return readFileSync(filePath, 'utf-8').includes(search);
}

function findFilesContaining(dir: string, ext: string, search: string): string[] {
  return glob(`**/*${ext}`, dir).filter(f => fileContains(f, search));
}

// ── Checks ────────────────────────────────────────────────────────────

const checks: Check[] = [
  // ─── Gap 1: Telemetry ───────────────────────────────────────────────
  {
    name: 'Telemetry enabled on AI calls',
    description: 'Every streamText/generateText call must have experimental_telemetry',
    check: () => {
      const apiFiles = glob('**/*.ts', 'app/api');
      const libFiles = glob('**/*.ts', 'lib/ai');
      const allFiles = [...apiFiles, ...libFiles];

      const violations: string[] = [];
      for (const file of allFiles) {
        const content = readFileSync(file, 'utf-8');
        // Check for streamText or generateText calls without telemetry
        const hasAICall = content.includes('streamText(') || content.includes('generateText(');
        const hasTelemetry = content.includes('experimental_telemetry') || content.includes('withTelemetry');
        if (hasAICall && !hasTelemetry) {
          violations.push(file);
        }
      }

      return violations.length === 0
        ? { pass: true, message: 'All AI calls have telemetry enabled', severity: 'error' }
        : { pass: false, message: `${violations.length} file(s) with AI calls missing telemetry`, files: violations, severity: 'error' };
    },
  },

  // ─── Gap 2: @ts-nocheck ─────────────────────────────────────────────
  {
    name: 'No @ts-nocheck in test files',
    description: 'Test files must not bypass TypeScript checking',
    check: () => {
      const testFiles = [
        ...glob('**/*.ts', 'tests'),
        ...glob('**/*.tsx', 'tests'),
      ];
      const violations = testFiles.filter(f => {
        const content = readFileSync(f, 'utf-8');
        return content.includes('@ts-nocheck');
      });

      return violations.length === 0
        ? { pass: true, message: 'No @ts-nocheck found in test files', severity: 'error' }
        : { pass: false, message: `${violations.length} test file(s) with @ts-nocheck`, files: violations, severity: 'error' };
    },
  },

  // ─── Gap 3: Browser smoke test ──────────────────────────────────────
  {
    name: 'Browser smoke test exists',
    description: 'An E2E smoke test must exist for basic page load verification',
    check: () => {
      const smokeTests = [
        ...glob('**/smoke*.spec.ts', 'tests'),
        ...glob('**/smoke*.spec.ts', 'e2e'),
        ...glob('**/smoke*.test.ts', 'tests'),
      ];
      return smokeTests.length > 0
        ? { pass: true, message: `Found ${smokeTests.length} smoke test(s)`, severity: 'error' }
        : { pass: false, message: 'No smoke test found. Create tests/e2e/smoke.spec.ts', severity: 'error' };
    },
  },

  // ─── Gap 5: Reasoning display ───────────────────────────────────────
  {
    name: 'Reasoning parts handled in chat UI',
    description: 'Chat message renderer must handle part.type === "reasoning"',
    check: () => {
      const chatFiles = [
        ...glob('**/*[Cc]hat*.tsx', 'components'),
        ...glob('**/*[Cc]hat*.tsx', 'app'),
        ...glob('**/*[Mm]essage*.tsx', 'components'),
      ];
      const hasReasoning = chatFiles.some(f => {
        const content = readFileSync(f, 'utf-8');
        return content.includes("'reasoning'") || content.includes('"reasoning"');
      });

      return hasReasoning
        ? { pass: true, message: 'Reasoning part handler found', severity: 'warning' }
        : { pass: false, message: 'No reasoning part handler found in chat components', severity: 'warning' };
    },
  },

  // ─── Gap 6: Nightly CI ──────────────────────────────────────────────
  {
    name: 'Nightly CI workflow exists',
    description: 'A scheduled CI workflow must exist for regression testing',
    check: () => {
      const nightlyPaths = [
        '.github/workflows/nightly.yml',
        '.github/workflows/nightly.yaml',
        '.github/workflows/scheduled.yml',
        '.github/workflows/scheduled.yaml',
      ];
      const exists = nightlyPaths.some(p => existsSync(p));
      return exists
        ? { pass: true, message: 'Nightly CI workflow found', severity: 'warning' }
        : { pass: false, message: 'No nightly CI workflow found. Create .github/workflows/nightly.yml', severity: 'warning' };
    },
  },

  // ─── Gap 7: No debug console.log in source ──────────────────────────
  {
    name: 'No debug console.log in source files',
    description: 'Source files should not contain debug logging (use structured logger)',
    check: () => {
      const sourceFiles = [
        ...glob('**/*.ts', 'lib'),
        ...glob('**/*.tsx', 'lib'),
        ...glob('**/*.ts', 'components'),
        ...glob('**/*.tsx', 'components'),
      ];
      const violations: string[] = [];
      for (const file of sourceFiles) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Allow console.error, console.warn (intentional), skip comments
          if (line.startsWith('//') || line.startsWith('*')) continue;
          if (line.includes('console.log(') && !line.includes('// keep')) {
            violations.push(`${file}:${i + 1}`);
          }
        }
      }

      return violations.length === 0
        ? { pass: true, message: 'No debug console.log in source', severity: 'warning' }
        : { pass: false, message: `${violations.length} console.log(s) found in source`, files: violations.slice(0, 10), severity: 'warning' };
    },
  },

  // ─── Gap 12: Docs freshness (manifest-based) ──────────────────────
  {
    name: 'Docs manifest exists and is valid',
    description: 'docs/manifest.json must exist with entries for all doc files',
    check: () => {
      const manifestPath = 'docs/manifest.json';
      if (!existsSync(manifestPath)) {
        return { pass: false, message: 'docs/manifest.json missing. Run `tsx scripts/docs-generate-manifest.ts`', severity: 'warning' };
      }

      let manifest: { version: number; docs: Array<{ id: string; localPath: string; contentHash: string; priority: string }> };
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } catch {
        return { pass: false, message: 'docs/manifest.json is not valid JSON', severity: 'error' };
      }

      if (!manifest.docs || manifest.docs.length === 0) {
        return { pass: false, message: 'docs/manifest.json has no entries', severity: 'warning' };
      }

      // Check that all manifest files exist on disk
      const missingFiles: string[] = [];
      const staleFiles: string[] = [];

      for (const doc of manifest.docs) {
        const filePath = doc.localPath;
        if (!existsSync(filePath)) {
          missingFiles.push(`${doc.id} (${filePath})`);
          continue;
        }

        // Verify content hash matches (detect untracked edits)
        const content = readFileSync(filePath, 'utf-8');
        const currentHash = createHash('sha256').update(content, 'utf-8').digest('hex');
        if (currentHash !== doc.contentHash) {
          staleFiles.push(`${doc.id} (${filePath})`);
        }
      }

      const issues = [...missingFiles.map(f => `missing: ${f}`), ...staleFiles.map(f => `modified: ${f}`)];

      if (issues.length === 0) {
        return { pass: true, message: `All ${manifest.docs.length} docs in manifest are current`, severity: 'warning' };
      }

      // Check if any hot docs are affected
      const hotIssueIds = new Set([
        ...missingFiles.map(f => f.split(' ')[0]),
        ...staleFiles.map(f => f.split(' ')[0]),
      ]);
      const hotProblems = manifest.docs.filter(d => d.priority === 'hot' && hotIssueIds.has(d.id));
      const severity = hotProblems.length > 0 ? 'error' : 'warning';

      return {
        pass: false,
        message: `${issues.length} doc(s) out of sync. Run \`tsx scripts/docs-sync.ts --update\` or regenerate manifest`,
        files: issues.slice(0, 10),
        severity: severity as 'error' | 'warning',
      };
    },
  },

  // ─── Gap 12: LLM.txt ───────────────────────────────────────────────
  {
    name: 'llms.txt exists',
    description: 'Machine-readable project description for AI agents',
    check: () => {
      const exists = existsSync('llms.txt') || existsSync('llms-full.txt');
      return exists
        ? { pass: true, message: 'llms.txt found', severity: 'warning' }
        : { pass: false, message: 'No llms.txt found. Create one for AI-accessible project info', severity: 'warning' };
    },
  },

  // ─── Registry sync (if registries exist) ────────────────────────────
  {
    name: 'Tool registry has mock data',
    description: 'Every tool in the registry must have corresponding mock data for testing',
    check: () => {
      // Look for common registry patterns
      const registryFiles = [
        ...glob('**/tool-meta.ts', 'lib'),
        ...glob('**/_metadata.ts', 'lib'),
        ...glob('**/_metadata.ts', 'src'),
      ];
      if (registryFiles.length === 0) {
        return { pass: true, message: 'No tool registry found (skipped)', severity: 'warning' };
      }

      const mockFiles = [
        ...glob('**/mock-tool-data.ts', 'lib'),
        ...glob('**/mock-tool-data.ts', 'src'),
        ...glob('**/mock*.ts', 'tests'),
      ];

      return mockFiles.length > 0
        ? { pass: true, message: 'Mock data files found for tool registry', severity: 'warning' }
        : { pass: false, message: 'Tool registry exists but no mock data found', severity: 'warning' };
    },
  },

  // ─── AGENTS.md exists ───────────────────────────────────────────────
  {
    name: 'AGENTS.md exists',
    description: 'Agent context file must exist for AI coding tools',
    check: () => {
      const exists = existsSync('AGENTS.md') || existsSync('CLAUDE.md');
      return exists
        ? { pass: true, message: 'Agent context file found', severity: 'warning' }
        : { pass: false, message: 'No AGENTS.md or CLAUDE.md found', severity: 'warning' };
    },
  },

  // ─── Visual regression baselines ────────────────────────────────────
  {
    name: 'Visual regression tests exist',
    description: 'Playwright visual regression tests should exist for key pages',
    check: () => {
      const visualTests = [
        ...glob('**/visual*.spec.ts', 'tests'),
        ...glob('**/visual*.spec.ts', 'e2e'),
        ...glob('**/screenshot*.spec.ts', 'tests'),
      ];
      // Also check for toHaveScreenshot usage in any test
      const allE2E = glob('**/*.spec.ts', 'tests');
      const hasScreenshot = allE2E.some(f => fileContains(f, 'toHaveScreenshot'));

      return (visualTests.length > 0 || hasScreenshot)
        ? { pass: true, message: 'Visual regression tests found', severity: 'warning' }
        : { pass: false, message: 'No visual regression tests. Add toHaveScreenshot() to E2E tests', severity: 'warning' };
    },
  },

  // ─── Husky hooks wired ──────────────────────────────────────────────
  {
    name: 'Git hooks are configured',
    description: 'Pre-commit and pre-push hooks must be wired via Husky',
    check: () => {
      const preCommit = existsSync('.husky/pre-commit');
      const prePush = existsSync('.husky/pre-push');

      if (preCommit && prePush) {
        return { pass: true, message: 'Pre-commit and pre-push hooks configured', severity: 'error' };
      }
      const missing = [];
      if (!preCommit) missing.push('.husky/pre-commit');
      if (!prePush) missing.push('.husky/pre-push');
      return { pass: false, message: `Missing hooks: ${missing.join(', ')}`, severity: 'error' };
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────

function run() {
  console.log('\n  Compliance Checker — Vercel AI Starter Kit\n');
  console.log('  ─────────────────────────────────────────────\n');

  let errors = 0;
  let warnings = 0;
  let passed = 0;

  for (const { name, check: runCheck } of checks) {
    const result = runCheck();
    const icon = result.pass ? '\x1b[32m✓\x1b[0m' : (result.severity === 'error' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m!\x1b[0m');
    console.log(`  ${icon}  ${name}`);

    if (!result.pass) {
      console.log(`     ${result.message}`);
      if (result.files && result.files.length > 0) {
        for (const f of result.files.slice(0, 5)) {
          console.log(`       - ${f}`);
        }
        if (result.files.length > 5) {
          console.log(`       ... and ${result.files.length - 5} more`);
        }
      }
      if (result.severity === 'error') errors++;
      else warnings++;
    } else {
      passed++;
    }
  }

  console.log('\n  ─────────────────────────────────────────────');
  console.log(`  ${passed} passed  ${warnings} warnings  ${errors} errors\n`);

  if (errors > 0) {
    console.log('  \x1b[31mCompliance check FAILED.\x1b[0m Fix errors above before pushing.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('  \x1b[33mCompliance check passed with warnings.\x1b[0m Consider fixing above.\n');
    process.exit(0);
  } else {
    console.log('  \x1b[32mAll compliance checks passed.\x1b[0m\n');
    process.exit(0);
  }
}

run();
