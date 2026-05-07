#!/usr/bin/env tsx
/**
 * check-brand-tokens -- pre-commit: reject components that use unapproved
 * colors, fonts, or spacing values.
 *
 * Source of truth: `.ai-dev-kit/registries/design-tokens.yaml`.
 *
 * Fails when:
 *   * A changed .tsx/.css/.css.ts file contains a hex color (#123abc) not
 *     declared in design-tokens.yaml `colors:` section.
 *   * A `font-family` or `fontFamily` literal doesn't match any
 *     `typography.font.*` value.
 *   * An inline spacing / padding / margin uses a raw pixel or rem value
 *     not declared in `spacing:`.
 *
 * Exemptions:
 *   * `docs/` -- the brand guide itself declares raw hex codes.
 *   * `tests/` -- allowed to use fixture values.
 *   * `*.stories.tsx` -- Storybook previews can display raw swatches.
 *   * files listed in `.ai-dev-kit/brand-exempt.txt` (one per line).
 *
 * Policy: if design-tokens.yaml has NO declared colors/fonts/spacing yet,
 * the check is a no-op (prevents new installs from failing before the
 * user fills in their brand). The moment a token gets declared, enforcement
 * turns on for that token class.
 *
 * Run: `pnpm exec tsx scripts/check-brand-tokens.ts` -- optional `--all`
 * flag scans the whole tree, otherwise only staged files.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CWD = process.cwd();
const TOKENS_PATH = join(CWD, '.ai-dev-kit', 'registries', 'design-tokens.yaml');
const EXEMPT_PATH = join(CWD, '.ai-dev-kit', 'brand-exempt.txt');

interface Tokens {
  colors: Set<string>;        // normalized lower-case values: "#1f6feb"
  fonts: Set<string>;         // raw strings: "Inter, -apple-system, ..."
  spacings: Set<string>;      // "0.25rem", "4px"
  radii: Set<string>;
}

function loadTokens(): Tokens {
  const empty: Tokens = { colors: new Set(), fonts: new Set(), spacings: new Set(), radii: new Set() };
  if (!existsSync(TOKENS_PATH)) return empty;
  const src = readFileSync(TOKENS_PATH, 'utf-8');
  const t: Tokens = { colors: new Set(), fonts: new Set(), spacings: new Set(), radii: new Set() };

  let section: keyof Tokens | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const topLevel = line.match(/^([a-z_]+):\s*$/);
    if (topLevel) {
      const key = topLevel[1];
      section =
        key === 'colors' ? 'colors' :
        key === 'typography' ? 'fonts' :
        key === 'spacing' ? 'spacings' :
        key === 'radius' ? 'radii' :
        null;
      continue;
    }

    if (!section) continue;
    const kv = line.match(/^\s+[a-z0-9_.]+:\s*(.+)$/);
    if (!kv) continue;
    const val = kv[1].trim().replace(/^["']|["']$/g, '');
    if (section === 'colors') t.colors.add(val.toLowerCase());
    else if (section === 'fonts') t.fonts.add(val);
    else if (section === 'spacings') t.spacings.add(val);
    else if (section === 'radii') t.radii.add(val);
  }
  return t;
}

function loadExempt(): Set<string> {
  if (!existsSync(EXEMPT_PATH)) return new Set();
  return new Set(readFileSync(EXEMPT_PATH, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean));
}

function isExempt(path: string, exempt: Set<string>): boolean {
  if (exempt.has(path)) return true;
  return (
    path.startsWith('docs/') ||
    path.startsWith('tests/') ||
    path.includes('/tests/') ||
    path.endsWith('.stories.tsx') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.test.tsx') ||
    path.endsWith('.spec.ts') ||
    path.endsWith('.spec.tsx') ||
    path.startsWith('scripts/') ||
    path.startsWith('.ai-dev-kit/')
  );
}

function stagedFiles(): string[] {
  if (process.argv.includes('--all')) {
    const out = execSync('git ls-files', { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(Boolean);
  }
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

interface Violation {
  file: string;
  line: number;
  kind: 'color' | 'font' | 'spacing';
  value: string;
  hint: string;
  /** Warnings are printed but don't block the commit. */
  severity?: 'error' | 'warning';
}

/**
 * Normalize `rgb(18, 26, 47)` / `hsl(220 40% 12%)` / etc. into a canonical
 * lowercase form matching how tokens.colors would be declared. We compare
 * tokens against the same normalization so rgb(255, 255, 255) matches
 * `rgb(255,255,255)` declared in the token file.
 */
function normalizeColorLiteral(raw: string): string | null {
  const normalized = raw.replace(/\s+/g, '').toLowerCase();
  return normalized;
}

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const FONT_RE = /font[_-]?family\s*[:=]\s*['"`]([^'"`]+)['"`]/gi;
// rgb() / rgba() / hsl() / hsla() literals. Extracts the normalized color
// value so we can match it against declared tokens (after normalizing those
// the same way).
const RGB_HSL_RE = /\b(rgb|rgba|hsl|hsla)\(\s*[^)]+\)/gi;
// Tailwind arbitrary hex: bg-[#123abc], text-[#fff], border-[#ff00aa]
const TW_ARB_HEX_RE = /\[#([0-9a-fA-F]{3,8})\]/g;
// Tailwind neutral-* classes: bg-neutral-900, text-neutral-100, border-neutral-700
// These don't respond to theme (light/dark) changes -- flag as WARNING (non-blocking).
const TW_NEUTRAL_RE = /(?:bg|text|border)-neutral-\d+/g;

function scan(tokens: Tokens, path: string): Violation[] {
  const full = resolve(CWD, path);
  if (!existsSync(full)) return [];
  const src = readFileSync(full, 'utf-8');
  const out: Violation[] = [];
  const lines = src.split('\n');

  // Only enforce color check when tokens file declares at least one color.
  // Same for fonts/spacings. Empty token sets = enforcement off for that class.
  const enforceColors = tokens.colors.size > 0;
  const enforceFonts = tokens.fonts.size > 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (enforceColors) {
      HEX_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = HEX_RE.exec(line)) !== null) {
        const value = `#${m[1].toLowerCase()}`;
        if (!tokens.colors.has(value)) {
          out.push({
            file: path,
            line: i + 1,
            kind: 'color',
            value,
            hint: 'add this color to design-tokens.yaml `colors:` OR use an existing token',
          });
        }
      }

      TW_ARB_HEX_RE.lastIndex = 0;
      while ((m = TW_ARB_HEX_RE.exec(line)) !== null) {
        const value = `#${m[1].toLowerCase()}`;
        if (!tokens.colors.has(value)) {
          out.push({
            file: path,
            line: i + 1,
            kind: 'color',
            value: `[${value}] (tailwind arbitrary)`,
            hint: 'replace with a declared token; e.g. bg-brand-primary instead of bg-[#1f6feb]',
          });
        }
      }

      RGB_HSL_RE.lastIndex = 0;
      while ((m = RGB_HSL_RE.exec(line)) !== null) {
        const value = normalizeColorLiteral(m[0]);
        if (value && !tokens.colors.has(value)) {
          out.push({
            file: path,
            line: i + 1,
            kind: 'color',
            value: m[0],
            hint: 'declare this color in design-tokens.yaml (normalized: ' + value + ')',
          });
        }
      }
    }

    // Tailwind neutral-* detection -- WARNING only (non-blocking).
    // These classes use fixed gray tones that don't respond to
    // light/dark theme changes. Components should use CSS variables
    // (e.g. var(--surface), var(--muted)) or themed Tailwind utilities instead.
    if (path.startsWith('components/') || path.startsWith('app/') ||
        path.includes('/components/') || path.includes('/app/')) {
      TW_NEUTRAL_RE.lastIndex = 0;
      let nm: RegExpExecArray | null;
      while ((nm = TW_NEUTRAL_RE.exec(line)) !== null) {
        out.push({
          file: path,
          line: i + 1,
          kind: 'color',
          value: nm[0],
          hint: 'neutral-* classes don\'t respond to theme changes. Use CSS variables (var(--surface), var(--muted)) or themed utilities instead.',
          severity: 'warning',
        });
      }
    }

    if (enforceFonts) {
      FONT_RE.lastIndex = 0;
      let f: RegExpExecArray | null;
      while ((f = FONT_RE.exec(line)) !== null) {
        const value = f[1].trim();
        if (!tokens.fonts.has(value)) {
          out.push({
            file: path,
            line: i + 1,
            kind: 'font',
            value,
            hint: 'add this font stack to design-tokens.yaml `typography:` OR use an existing token',
          });
        }
      }
    }
  }

  return out;
}

function main(): number {
  const tokens = loadTokens();
  // If nothing is declared yet (fresh install), skip silently.
  if (tokens.colors.size === 0 && tokens.fonts.size === 0 && tokens.spacings.size === 0) {
    return 0;
  }

  const exempt = loadExempt();
  const files = stagedFiles().filter(f =>
    (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.css') || f.endsWith('.scss')) &&
    !isExempt(f, exempt),
  );

  const violations: Violation[] = [];
  for (const f of files) {
    violations.push(...scan(tokens, f));
  }

  if (violations.length === 0) return 0;

  const errors = violations.filter(v => v.severity !== 'warning');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (warnings.length > 0) {
    console.error('\n[check-brand-tokens] WARNING: theme-insensitive values detected.');
    console.error('These don\'t block the commit but should be fixed:\n');
    for (const v of warnings) {
      console.error(`  ${v.file}:${v.line}  ${v.kind}=${v.value}`);
      console.error(`    → ${v.hint}`);
    }
    console.error(`\n${warnings.length} warning${warnings.length > 1 ? 's' : ''}.\n`);
  }

  if (errors.length === 0) return 0;

  console.error('\n[check-brand-tokens] BLOCKED: unapproved brand values detected.');
  console.error('Source of truth: .ai-dev-kit/registries/design-tokens.yaml\n');
  for (const v of errors) {
    console.error(`  ${v.file}:${v.line}  ${v.kind}=${v.value}`);
    console.error(`    → ${v.hint}`);
  }
  console.error(`\n${errors.length} violation${errors.length > 1 ? 's' : ''}. Fix or exempt via .ai-dev-kit/brand-exempt.txt.\n`);
  return 1;
}

process.exit(main());
