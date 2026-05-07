#!/usr/bin/env tsx
/**
 * generate-playwright-from-manifest -- read features/<feature>/
 * TEST-MANIFEST.yaml and emit tests/e2e/<feature>.spec.ts plus a shared
 * tests/e2e/_helpers.ts stub.
 *
 * Invocation:
 *   npx tsx scripts/generate-playwright-from-manifest.ts <feature>
 *
 * Generated output is owned by this script. Manual edits are clobbered
 * on regen. Use escape_hatch (language: playwright) to inject verbatim code.
 *
 * The helpers file is NOT clobbered on every regen -- it's written only
 * when absent so projects can extend it. The drift check still reads its
 * checksum, but regeneration does not destroy hand-added helpers.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseManifest, type Manifest, type Step } from './lib/manifest-parser.ts';

const CWD = process.cwd();

function usage(): never {
  process.stderr.write('\n  usage: npx tsx scripts/generate-playwright-from-manifest.ts <feature>\n\n');
  process.exit(2);
}

function quoteString(s: string): string {
  if (s.includes('\n')) return '`' + s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  return JSON.stringify(s);
}

function renderStep(step: Step): string[] {
  const lines: string[] = [];
  switch (step.action) {
    case 'navigate':
      lines.push(`    await page.goto(${quoteString(step.to)});`);
      break;
    case 'click':
      lines.push(`    await page.click(${quoteString(step.locator)});`);
      break;
    case 'type':
      lines.push(`    await page.fill(${quoteString(step.locator)}, ${quoteString(step.text)});`);
      break;
    case 'expect_visible': {
      const within = typeof step.within_seconds === 'number' ? step.within_seconds : 5;
      lines.push(`    await expect(page.locator(${quoteString(step.locator)})).toBeVisible({ timeout: ${within * 1000} });`);
      break;
    }
    case 'expect_text':
      lines.push(`    await expect(page.locator(${quoteString(step.locator)})).toHaveText(${quoteString(step.text)});`);
      break;
    case 'expect_text_contains':
      lines.push(`    await expect(page.locator(${quoteString(step.locator)})).toContainText(${quoteString(step.substring)});`);
      break;
    case 'expect_text_grows': {
      const within = typeof step.within_seconds === 'number' ? step.within_seconds : 10;
      const minChars = typeof step.min_growth_chars === 'number' ? step.min_growth_chars : 20;
      const sample = typeof step.sample_ms === 'number' ? step.sample_ms : 500;
      lines.push(`    await expectTextGrows(page, ${quoteString(step.locator)}, { minGrowthChars: ${minChars}, withinSeconds: ${within}, sampleMs: ${sample} });`);
      break;
    }
    case 'expect_count_at_least':
      lines.push(`    {`);
      lines.push(`      const count = await page.locator(${quoteString(step.locator)}).count();`);
      lines.push(`      expect(count, 'expect_count_at_least: ${step.locator} >= ${step.count}').toBeGreaterThanOrEqual(${step.count});`);
      lines.push(`    }`);
      break;
    case 'feed_audio_fixture':
      lines.push(`    await feedAudioFixture(page, ${quoteString(step.fixture)});`);
      break;
    case 'escape_hatch':
      if (step.language === 'playwright') {
        lines.push(`    // escape_hatch: ${step.reason.replace(/\n/g, ' ')}`);
        for (const codeLine of step.code.split('\n')) {
          lines.push(`    ${codeLine}`);
        }
      } else {
        lines.push(`    // escape_hatch (language: ${step.language}) skipped in playwright generator.`);
        lines.push(`    // reason: ${step.reason.replace(/\n/g, ' ')}`);
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

function usesHelper(manifest: Manifest, action: Step['action']): boolean {
  for (const flow of manifest.user_flows) {
    for (const step of flow.steps) {
      if (step.action === action) return true;
    }
  }
  return false;
}

function render(feature: string, manifest: Manifest): string {
  const needsGrows = usesHelper(manifest, 'expect_text_grows');
  const needsAudio = usesHelper(manifest, 'feed_audio_fixture');
  const helperImports: string[] = [];
  if (needsGrows) helperImports.push('expectTextGrows');
  if (needsAudio) helperImports.push('feedAudioFixture');

  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED from features/${feature}/TEST-MANIFEST.yaml -- edit the manifest, not this file.`);
  lines.push(`// Regenerate: npx tsx scripts/generate-playwright-from-manifest.ts ${feature}`);
  lines.push(`// Or via CLI:  ai-dev-kit manifest generate ${feature}`);
  lines.push('');
  lines.push(`import { test, expect } from '@playwright/test';`);
  if (helperImports.length) {
    lines.push(`import { ${helperImports.join(', ')} } from './_helpers';`);
  }
  lines.push('');
  lines.push(`test.describe(${quoteString('e2e: ' + feature)}, () => {`);
  for (const flow of manifest.user_flows) {
    lines.push(...renderFlow(flow.name, flow.description, flow.steps));
    lines.push('');
  }
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

const HELPERS_BODY = `// Shared helpers for auto-generated Playwright specs under tests/e2e/.
// This file is written once by generate-playwright-from-manifest.ts when
// absent. Subsequent generator runs leave it alone so your project can
// extend feedAudioFixture with the correct MediaStream shim.

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface ExpectTextGrowsOptions {
  minGrowthChars?: number;
  withinSeconds?: number;
  sampleMs?: number;
}

/**
 * Poll the locator's textContent and assert its length grows by at least
 * minGrowthChars within withinSeconds. Useful for streaming UIs where the
 * text arrives a token at a time.
 */
export async function expectTextGrows(
  page: Page,
  selector: string,
  options: ExpectTextGrowsOptions = {},
): Promise<void> {
  const minGrowthChars = options.minGrowthChars ?? 20;
  const withinSeconds = options.withinSeconds ?? 10;
  const sampleMs = options.sampleMs ?? 500;
  const deadline = Date.now() + withinSeconds * 1000;
  const start = (await page.locator(selector).textContent()) ?? '';
  let now = start;
  while (Date.now() < deadline) {
    now = (await page.locator(selector).textContent()) ?? '';
    if (now.length - start.length >= minGrowthChars) return;
    await page.waitForTimeout(sampleMs);
  }
  expect(
    now.length - start.length,
    'expect_text_grows: ' + selector + ' did not grow by ' + minGrowthChars + ' chars in ' + withinSeconds + 's',
  ).toBeGreaterThanOrEqual(minGrowthChars);
}

/**
 * Feed a pre-recorded audio fixture to the page's mic. Stub -- wire up
 * your project's test-mode MediaStream shim here. The manifest generator
 * calls this whenever a feed_audio_fixture step appears.
 */
export async function feedAudioFixture(_page: Page, fixture: string): Promise<void> {
  // TODO(manifest): inject tests/fixtures/audio/<fixture> into the page's
  // MediaStream. See docs/TESTING.md in the kit for the recommended shim.
  throw new Error(
    'feedAudioFixture not wired for this project yet. Fixture requested: ' + fixture +
    '. Implement the MediaStream shim in tests/e2e/_helpers.ts.',
  );
}
`;

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
  // a tmpfile for byte-compare without touching tests/e2e.
  const outBase = process.env.MANIFEST_OUT_DIR ?? join(CWD, 'tests');
  const outPath = join(outBase, 'e2e', `${feature}.spec.ts`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  process.stdout.write(`[generate-playwright] wrote ${outPath.replace(CWD + '/', '')}\n`);

  // Helpers live under tests/e2e/ regardless of MANIFEST_OUT_DIR so the
  // drift check doesn't overwrite the project's extended helpers.
  const helpersPath = join(CWD, 'tests', 'e2e', '_helpers.ts');
  if (!existsSync(helpersPath) && !process.env.MANIFEST_OUT_DIR) {
    writeFileSync(helpersPath, HELPERS_BODY);
    process.stdout.write(`[generate-playwright] wrote ${helpersPath.replace(CWD + '/', '')}\n`);
  }
}

main();
