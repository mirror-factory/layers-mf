#!/usr/bin/env tsx
/**
 * generate-expect-from-manifest -- read features/<feature>/TEST-MANIFEST.yaml
 * and emit tests/expect/<feature>.expect.ts.
 *
 * Invocation:
 *   npx tsx scripts/generate-expect-from-manifest.ts <feature>
 *
 * The Expect generator turns structured steps into natural-language
 * assertions against @anthropic-ai/expect. Where the action has a description,
 * that description is used verbatim as the toMatch() sentence. Where it
 * does not, the generator falls back to a synthesized sentence from the
 * action + locator.
 *
 * Generated output is owned by this script. Manual edits are clobbered.
 * Use escape_hatch (language: expect) to inject verbatim test code.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseManifest, type Manifest, type Step } from './lib/manifest-parser.ts';

const CWD = process.cwd();

function usage(): never {
  process.stderr.write('\n  usage: npx tsx scripts/generate-expect-from-manifest.ts <feature>\n\n');
  process.exit(2);
}

function quoteString(s: string): string {
  // Single-line strings become double-quoted JSON literals; multi-line ones
  // become template literals so we don't have to escape newlines.
  if (s.includes('\n')) return '`' + s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  return JSON.stringify(s);
}

function sentenceFor(step: Step): string {
  if (step.description) return step.description;
  switch (step.action) {
    case 'navigate': return `the user is on the ${step.to} page`;
    case 'click': return `the user clicks ${step.locator}`;
    case 'type': return `the user types into ${step.locator}`;
    case 'expect_visible': return `${step.locator} is visible to the user`;
    case 'expect_text': return `${step.locator} reads exactly "${step.text}"`;
    case 'expect_text_contains': return `${step.locator} contains the text "${step.substring}"`;
    case 'expect_text_grows': return `${step.locator} streams content -- its text grows over time`;
    case 'expect_count_at_least': return `at least ${step.count} ${step.locator} element(s) are visible`;
    case 'feed_audio_fixture': return `an audio fixture (${step.fixture}) is piped to the microphone`;
    case 'escape_hatch': return step.reason ?? 'escape-hatch step executed';
  }
}

function renderStep(step: Step): string[] {
  const lines: string[] = [];
  switch (step.action) {
    case 'navigate':
      lines.push(`      await page.goto(${quoteString(step.to)});`);
      lines.push(`      await expect(page).toMatch(${quoteString(sentenceFor(step))});`);
      break;
    case 'click':
      lines.push(`      await page.click(${quoteString(step.locator)});`);
      break;
    case 'type':
      lines.push(`      await page.fill(${quoteString(step.locator)}, ${quoteString(step.text)});`);
      break;
    case 'expect_visible':
    case 'expect_text':
    case 'expect_text_contains':
      lines.push(`      await expect(page).toMatch(${quoteString(sentenceFor(step))});`);
      break;
    case 'expect_text_grows': {
      const within = typeof step.within_seconds === 'number' ? step.within_seconds : 10;
      const minChars = typeof step.min_growth_chars === 'number' ? step.min_growth_chars : 20;
      const sample = typeof step.sample_ms === 'number' ? step.sample_ms : 500;
      lines.push(`      // Poll the locator's text length; assert it grows by at least ${minChars} chars`);
      lines.push(`      // within ${within}s, sampling every ${sample}ms.`);
      lines.push(`      {`);
      lines.push(`        const deadline = Date.now() + ${within * 1000};`);
      lines.push(`        const start = (await page.locator(${quoteString(step.locator)}).textContent()) ?? '';`);
      lines.push(`        let grew = false;`);
      lines.push(`        while (Date.now() < deadline) {`);
      lines.push(`          const now = (await page.locator(${quoteString(step.locator)}).textContent()) ?? '';`);
      lines.push(`          if (now.length - start.length >= ${minChars}) { grew = true; break; }`);
      lines.push(`          await new Promise((r) => setTimeout(r, ${sample}));`);
      lines.push(`        }`);
      lines.push(`        if (!grew) throw new Error(${quoteString(`expect_text_grows: ${step.locator} did not grow by ${minChars} chars in ${within}s`)});`);
      lines.push(`      }`);
      lines.push(`      await expect(page).toMatch(${quoteString(sentenceFor(step))});`);
      break;
    }
    case 'expect_count_at_least':
      lines.push(`      await expect(page).toMatch(${quoteString(sentenceFor(step))});`);
      break;
    case 'feed_audio_fixture':
      lines.push(`      // TODO(manifest): wire up audio fixture injection for ${step.fixture}.`);
      lines.push(`      // Expect cannot drive the MediaStream directly -- mount your project's`);
      lines.push(`      // test-mode mic shim here, or escape_hatch with language: expect.`);
      lines.push(`      await expect(page).toMatch(${quoteString(sentenceFor(step))});`);
      break;
    case 'escape_hatch':
      if (step.language === 'expect') {
        lines.push(`      // escape_hatch: ${step.reason.replace(/\n/g, ' ')}`);
        for (const codeLine of step.code.split('\n')) {
          lines.push(`      ${codeLine}`);
        }
      } else {
        lines.push(`      // escape_hatch (language: ${step.language}) skipped in expect generator.`);
        lines.push(`      // reason: ${step.reason.replace(/\n/g, ' ')}`);
      }
      break;
  }
  return lines;
}

function renderFlow(flowName: string, description: string | undefined, steps: Step[]): string[] {
  const lines: string[] = [];
  lines.push(`  test(${quoteString(flowName)}, async ({ page }) => {`);
  if (description) lines.push(`    // ${description.replace(/\n/g, ' ')}`);
  for (const step of steps) {
    lines.push(...renderStep(step));
  }
  lines.push('  });');
  return lines;
}

function render(feature: string, manifest: Manifest): string {
  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED from features/${feature}/TEST-MANIFEST.yaml -- edit the manifest, not this file.`);
  lines.push(`// Regenerate: npx tsx scripts/generate-expect-from-manifest.ts ${feature}`);
  lines.push(`// Or via CLI:  ai-dev-kit manifest generate ${feature}`);
  lines.push('');
  lines.push(`import { test, expect } from '@anthropic-ai/expect';`);
  lines.push('');
  lines.push(`test.describe(${quoteString('expect: ' + feature)}, () => {`);
  for (const flow of manifest.user_flows) {
    lines.push(...renderFlow(flow.name, flow.description, flow.steps));
    lines.push('');
  }
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const feature = process.argv[2];
  if (!feature) usage();

  const manifestPath = join(CWD, 'features', feature, 'TEST-MANIFEST.yaml');
  if (!existsSync(manifestPath)) {
    process.stderr.write(`\n  TEST-MANIFEST.yaml not found at ${manifestPath}\n`);
    process.stderr.write(`  Seed one: ai-dev-kit manifest seed ${feature}\n\n`);
    process.exit(1);
  }

  const manifest = parseManifest(readFileSync(manifestPath, 'utf-8'));
  const out = render(feature, manifest);
  // MANIFEST_OUT_DIR lets check-manifest-drift redirect the emitted spec to
  // a tmpfile for byte-compare without touching tests/expect.
  const outBase = process.env.MANIFEST_OUT_DIR ?? join(CWD, 'tests');
  const outPath = join(outBase, 'expect', `${feature}.expect.ts`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  process.stdout.write(`[generate-expect] wrote ${outPath.replace(CWD + '/', '')}\n`);
}

main();
