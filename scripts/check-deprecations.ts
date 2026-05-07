#!/usr/bin/env tsx
/**
 * check-deprecations -- scan source for known-deprecated vendor API fields.
 *
 * Brittle on purpose: this is a hand-maintained list of field renames and
 * obsolete APIs that have already bitten real projects. It runs in
 * pre-commit (fast regex search) so the agent gets a warning the moment
 * it writes a deprecated call, instead of finding out when the server
 * returns 500.
 *
 * Adding to this list: when a vendor breaks you, add the old pattern here
 * with a link to the migration docs. Future you will thank past you.
 *
 * Exit codes:
 *   0 -- no deprecated patterns found
 *   1 -- at least one deprecation matched (prints file:line:pattern)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

interface Deprecation {
  /** Pattern that matches the deprecated usage. Use string for literal, RegExp for more. */
  pattern: RegExp;
  /** Human-readable name of the vendor + what they changed. */
  vendor: string;
  /** Short fix instruction. */
  fix: string;
  /** URL to the vendor's migration notes. */
  url: string;
}

const DEPRECATIONS: Deprecation[] = [
  {
    vendor: 'AssemblyAI',
    pattern: /\bspeech_model\s*:/,
    fix: 'Rename `speech_model:` to `speech_models:` and pass an array of model names (e.g. ["universal-3-pro"]).',
    url: 'https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model',
  },
  {
    vendor: 'AI SDK',
    pattern: /\btoDataStreamResponse\s*\(/,
    fix: 'Use `toUIMessageStreamResponse()` instead of `toDataStreamResponse()` (AI SDK v6 rename).',
    url: 'https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0',
  },
  {
    vendor: 'AI SDK',
    pattern: /parameters:\s*z\./,
    fix: 'In AI SDK v6, tool definitions use `inputSchema:` not `parameters:`.',
    url: 'https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0',
  },
  {
    vendor: 'AI SDK',
    pattern: /addToolResult\s*\(/,
    fix: 'In AI SDK v6, the chat store method is `addToolOutput` not `addToolResult`.',
    url: 'https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0',
  },
  {
    vendor: 'AI SDK',
    pattern: /\.append\s*\(/,
    fix: 'AI SDK v6 renamed chat.append to chat.sendMessage. Review call sites.',
    url: 'https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0',
  },
  {
    vendor: 'AI SDK',
    pattern: /maxSteps\s*:/,
    fix: 'Use stopWhen: stepCountIs(N) instead of maxSteps (AI SDK v6).',
    url: 'https://sdk.vercel.ai/docs',
  },
];

// Cross-file checks: patterns that require inspecting the whole file, not just
// individual lines. These detect structural issues like missing configuration
// that spans multiple lines.
interface CrossFileCheck {
  /** Human-readable description. */
  name: string;
  /** Returns hits for the entire file content. */
  check: (content: string, relPath: string) => Array<{ line: number; match: string; fix: string }>;
}

const CROSS_FILE_CHECKS: CrossFileCheck[] = [
  {
    name: 'AI SDK v6: streamText + tools without stopWhen',
    check(content, relPath) {
      // Only check files that import tools AND use streamText.
      const hasToolImport = /import\b.*\btools\b|tools\s*[:=]/.test(content);
      const hasStreamText = /\bstreamText\s*\(/.test(content);
      if (!hasToolImport || !hasStreamText) return [];

      const hasStopWhen = /\bstopWhen\b/.test(content);
      if (hasStopWhen) return [];

      // Find the line with streamText( to report accurately.
      const lines = content.split('\n');
      const hits: Array<{ line: number; match: string; fix: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        if (/\bstreamText\s*\(/.test(lines[i])) {
          hits.push({
            line: i + 1,
            match: lines[i].trim().slice(0, 100),
            fix: 'streamText with tools but no stopWhen — AI will stop after first tool call. Use stopWhen: stepCountIs(N)',
          });
        }
      }
      return hits;
    },
  },
];

const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.test-results']);
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.some(ext => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function checkFile(file: string, rel: string): Array<{ vendor: string; line: number; match: string; fix: string; url: string }> {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const hits: Array<{ vendor: string; line: number; match: string; fix: string; url: string }> = [];
  for (const dep of DEPRECATIONS) {
    lines.forEach((line, idx) => {
      if (dep.pattern.test(line)) {
        hits.push({ vendor: dep.vendor, line: idx + 1, match: line.trim().slice(0, 100), fix: dep.fix, url: dep.url });
      }
    });
  }
  return hits;
}

/**
 * Gap 17: Check provider version compatibility.
 * If `ai` >= 6.0.0 and `ollama-ai-provider` (not v2) is installed, flag it.
 */
function checkProviderVersions(cwd: string): boolean {
  const pkgPath = join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const aiVersion = deps['ai'];
    const ollamaVersion = deps['ollama-ai-provider'];

    if (!aiVersion || !ollamaVersion) return false;

    // Extract major version from semver (handles ^6.0.0, ~6.1.0, 6.0.0, >=6.0.0, etc.)
    const parseMajor = (v: string): number | null => {
      const m = v.match(/(\d+)\.\d+/);
      return m ? parseInt(m[1], 10) : null;
    };

    const aiMajor = parseMajor(aiVersion);
    const ollamaMajor = parseMajor(ollamaVersion);

    if (aiMajor !== null && aiMajor >= 6 && ollamaMajor !== null && ollamaMajor < 2) {
      process.stdout.write('Incompatible provider version detected:\n\n');
      process.stdout.write(`  ai@${aiVersion} (v6+) requires model spec v2\n`);
      process.stdout.write(`  ollama-ai-provider@${ollamaVersion} implements model spec v1\n`);
      process.stdout.write(`  Fix: Upgrade to ollama-ai-provider@^2.0.0 or use @ai-sdk/ollama\n`);
      process.stdout.write(`  See: https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0\n\n`);
      return true;
    }
  } catch {
    // package.json missing or malformed -- skip.
  }
  return false;
}

function main(): void {
  const cwd = process.cwd();

  // Gap 17: Provider version compatibility check.
  const providerIssue = checkProviderVersions(cwd);

  const roots = ['lib', 'app', 'components', 'src'].map(d => join(cwd, d)).filter(d => {
    try { return statSync(d).isDirectory(); } catch { return false; }
  });

  const files = roots.flatMap(r => walk(r));
  let anyHit = false;
  for (const file of files) {
    const rel = relative(cwd, file);
    const hits = checkFile(file, rel);
    for (const hit of hits) {
      if (!anyHit) {
        process.stdout.write('Deprecated vendor API usage detected:\n\n');
        anyHit = true;
      }
      process.stdout.write(`  ${rel}:${hit.line}  [${hit.vendor}]\n`);
      process.stdout.write(`    ${hit.match}\n`);
      process.stdout.write(`    Fix: ${hit.fix}\n`);
      process.stdout.write(`    See: ${hit.url}\n\n`);
    }

    // Cross-file structural checks (e.g. streamText + tools without stopWhen).
    try {
      const content = readFileSync(file, 'utf-8');
      for (const xfc of CROSS_FILE_CHECKS) {
        const xhits = xfc.check(content, rel);
        for (const xh of xhits) {
          if (!anyHit) {
            process.stdout.write('Deprecated vendor API usage detected:\n\n');
            anyHit = true;
          }
          process.stdout.write(`  ${rel}:${xh.line}  [${xfc.name}]\n`);
          process.stdout.write(`    ${xh.match}\n`);
          process.stdout.write(`    Fix: ${xh.fix}\n\n`);
        }
      }
    } catch { /* skip unreadable files */ }
  }
  if (anyHit || providerIssue) process.exit(1);
  process.stdout.write('No deprecated patterns found.\n');
}

main();
