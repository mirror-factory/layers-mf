#!/usr/bin/env tsx
/**
 * generate-theme-css -- codegen bridge between design-tokens.yaml and the
 * browser-facing artifacts (CSS custom properties + Tailwind theme).
 *
 * This closes the "YAML vs global.css" confusion. You edit tokens in ONE
 * place (design-tokens.yaml). Pre-commit runs this script and emits:
 *
 *   - app/styles/tokens.css       (CSS custom properties)
 *   - app/styles/tokens.tailwind.ts (Tailwind v4 theme extension, if detected)
 *
 * Then globals.css does `@import "./tokens.css"` and every `color: var(--brand-primary)`
 * resolves to the value declared in YAML. Tailwind projects merge the generated
 * theme into their tailwind.config.
 *
 * Token name convention: `brand.primary` becomes `--brand-primary` (dot -> hyphen,
 * lowercase). Same mapping for CSS classes (`bg-brand-primary`).
 *
 * Runs:
 *   - pre-commit (auto-stages the emitted files alongside YAML edits)
 *   - standalone: `pnpm exec tsx scripts/generate-theme-css.ts`
 *
 * Exit codes:
 *   0 = emitted or no-op (empty tokens)
 *   1 = malformed tokens file
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const TOKENS_PATH = join(CWD, '.ai-dev-kit', 'registries', 'design-tokens.yaml');
const CSS_OUT = join(CWD, 'app', 'styles', 'tokens.css');
const TW_OUT = join(CWD, 'app', 'styles', 'tokens.tailwind.ts');

interface Tokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  motion: Record<string, string>;
  elevation: Record<string, string>;
  breakpoints: Record<string, string>;
}

function parse(src: string): Tokens {
  const tokens: Tokens = {
    colors: {}, typography: {}, spacing: {}, radius: {},
    shadow: {}, motion: {}, elevation: {}, breakpoints: {},
  };

  let section: keyof Tokens | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const top = line.match(/^([a-z_]+):\s*$/);
    if (top) {
      const key = top[1];
      if (key in tokens) section = key as keyof Tokens;
      else section = null;
      continue;
    }

    if (!section) continue;
    // Nested under the section: either a scalar value or an inline object.
    const kv = line.match(/^\s+([a-z0-9.]+):\s*(.+)$/);
    if (!kv) continue;
    const [, name, rawVal] = kv;
    const val = rawVal.trim().replace(/^["']|["']$/g, '');
    // Skip inline objects (scale.display: { size: "3rem", ... }) -- not in v1.
    if (val.startsWith('{')) continue;
    tokens[section][name] = val;
  }
  return tokens;
}

function toCssVar(key: string): string {
  return `--${key.replace(/\./g, '-').toLowerCase()}`;
}

function toTailwindKey(key: string): string {
  // brand.primary -> ["brand", "primary"] so Tailwind resolves to bg-brand-primary.
  return key.replace(/\./g, '-');
}

function renderCss(t: Tokens): string {
  const out: string[] = [];
  out.push('/**');
  out.push(' * tokens.css -- AUTO-GENERATED from .ai-dev-kit/registries/design-tokens.yaml');
  out.push(' * Do NOT edit by hand. Run pnpm exec tsx scripts/generate-theme-css.ts to regenerate.');
  out.push(' */');
  out.push(':root {');

  const sections: Array<[keyof Tokens, string]> = [
    ['colors',      'Colors'],
    ['typography',  'Typography'],
    ['spacing',     'Spacing'],
    ['radius',      'Radius'],
    ['shadow',      'Shadow'],
    ['motion',      'Motion'],
    ['elevation',   'Elevation (z-index)'],
    ['breakpoints', 'Breakpoints (reference only; media queries use these literals)'],
  ];

  for (const [k, label] of sections) {
    const entries = Object.entries(t[k]);
    if (entries.length === 0) continue;
    out.push('');
    out.push(`  /* ${label} */`);
    for (const [name, value] of entries) {
      out.push(`  ${toCssVar(name)}: ${value};`);
    }
  }

  out.push('}');
  out.push('');
  return out.join('\n');
}

function renderTailwind(t: Tokens): string {
  const out: string[] = [];
  out.push('/**');
  out.push(' * tokens.tailwind.ts -- AUTO-GENERATED from .ai-dev-kit/registries/design-tokens.yaml');
  out.push(' * Merge into your tailwind.config:');
  out.push(' *   import { tokens } from \'./app/styles/tokens.tailwind\';');
  out.push(' *   export default { theme: { extend: tokens }, ... };');
  out.push(' */');
  out.push('');

  const colors: Record<string, unknown> = nestByDot(t.colors);
  const spacing: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.spacing)) spacing[toTailwindKey(k)] = v;
  const radius: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.radius)) radius[toTailwindKey(k).replace(/^radius-/, '')] = v;
  const shadow: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.shadow)) shadow[toTailwindKey(k).replace(/^shadow-/, '')] = v;
  const screens: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.breakpoints)) screens[toTailwindKey(k)] = v;

  out.push('export const tokens = {');
  out.push(`  colors: ${JSON.stringify(colors, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
  if (Object.keys(spacing).length > 0) out.push(`  spacing: ${JSON.stringify(spacing, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
  if (Object.keys(radius).length > 0) out.push(`  borderRadius: ${JSON.stringify(radius, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
  if (Object.keys(shadow).length > 0) out.push(`  boxShadow: ${JSON.stringify(shadow, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
  if (Object.keys(screens).length > 0) out.push(`  screens: ${JSON.stringify(screens, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
  out.push('} as const;');
  out.push('');
  return out.join('\n');
}

/**
 * Collapse dotted keys into nested objects so Tailwind's arbitrary nesting
 * works: `brand.primary` -> { brand: { primary: "..." } } -> class `bg-brand-primary`.
 */
function nestByDot(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.');
    let cursor = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cursor[parts[i]] !== 'object' || cursor[parts[i]] === null) cursor[parts[i]] = {};
      cursor = cursor[parts[i]] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = v;
  }
  return out;
}

function usesTailwind(): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return 'tailwindcss' in all;
  } catch { return false; }
}

function main(): number {
  if (!existsSync(TOKENS_PATH)) {
    console.log('[generate-theme-css] no design-tokens.yaml; skipping.');
    return 0;
  }

  const src = readFileSync(TOKENS_PATH, 'utf-8');
  const tokens = parse(src);

  const totalEntries = Object.values(tokens).reduce((a, o) => a + Object.keys(o).length, 0);
  if (totalEntries === 0) {
    console.log('[generate-theme-css] tokens empty; no codegen emitted.');
    return 0;
  }

  mkdirSync(dirname(CSS_OUT), { recursive: true });
  writeFileSync(CSS_OUT, renderCss(tokens));
  console.log(`[generate-theme-css] wrote ${CSS_OUT} (${totalEntries} tokens)`);

  if (usesTailwind()) {
    writeFileSync(TW_OUT, renderTailwind(tokens));
    console.log(`[generate-theme-css] wrote ${TW_OUT}`);
  }

  return 0;
}

process.exit(main());
