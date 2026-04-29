/**
 * dev-kit theme loader -- hydrates the /dev-kit dashboard with the project's
 * design tokens so the dashboard itself demonstrates brand enforcement.
 *
 * Source of truth: `.ai-dev-kit/registries/design-tokens.yaml`.
 * The file is read once at module-init time and memoized in a module-level
 * Map. Server components call `getDevKitTheme()` freely; re-reading the YAML
 * on every render would be wasteful and the file only changes at build time.
 *
 * Fallback strategy:
 *   - Missing file          -> full default theme (dark-mint matching CLI banner).
 *   - File present, empty   -> full default theme.
 *   - Some tokens declared  -> declared values override defaults; the rest
 *                              fall back so the dashboard never renders with
 *                              undefined colors.
 *
 * Token name mapping (YAML key -> theme slot):
 *   colors.brand.primary   -> colors.primary
 *   colors.text.primary    -> colors.text
 *   colors.text.muted      -> colors.textMuted
 *   colors.bg.default      -> colors.bg
 *   colors.surface.default -> colors.surface
 *   colors.border.default  -> colors.border
 *   colors.state.success   -> colors.success
 *   colors.state.warn      -> colors.warn
 *   colors.state.error     -> colors.error
 *   typography.font.sans   -> font.sans
 *   typography.font.mono   -> font.mono
 *   spacing.space.1..8     -> space(n)
 *   radius.radius.sm|md|lg -> radius(size)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DevKitTheme {
  colors: {
    primary: string;
    text: string;
    textMuted: string;
    bg: string;
    surface: string;
    border: string;
    success: string;
    warn: string;
    error: string;
  };
  font: {
    sans: string;
    mono: string;
  };
  space: (step: 1 | 2 | 3 | 4 | 6 | 8) => string;
  radius: (size: 'sm' | 'md' | 'lg') => string;
}

// Dark-mint defaults. Match the CLI banner so the unconfigured dashboard
// still feels like part of the kit rather than a generic admin page.
const DEFAULT_COLORS: DevKitTheme['colors'] = {
  primary: '#34d399',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  bg: '#0b0f14',
  surface: '#111827',
  border: '#1f2937',
  success: '#22c55e',
  warn: '#f59e0b',
  error: '#ef4444',
};

const DEFAULT_FONTS: DevKitTheme['font'] = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

const DEFAULT_SPACE: Record<1 | 2 | 3 | 4 | 6 | 8, string> = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
};

const DEFAULT_RADII: Record<'sm' | 'md' | 'lg', string> = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
};

// Module-level cache. Keyed by absolute tokens-file path so different cwds
// (tests, monorepos) don't cross-contaminate.
const themeCache = new Map<string, DevKitTheme>();

const TOKEN_KEY_MAP: Record<string, keyof DevKitTheme['colors']> = {
  'brand.primary': 'primary',
  'text.primary': 'text',
  'text.muted': 'textMuted',
  'bg.default': 'bg',
  'surface.default': 'surface',
  'border.default': 'border',
  'state.success': 'success',
  'state.warn': 'warn',
  'state.error': 'error',
};

interface ParsedTokens {
  colors: Partial<Record<keyof DevKitTheme['colors'], string>>;
  fontSans?: string;
  fontMono?: string;
  space: Partial<Record<1 | 2 | 3 | 4 | 6 | 8, string>>;
  radius: Partial<Record<'sm' | 'md' | 'lg', string>>;
}

/**
 * Tiny YAML reader scoped to design-tokens.yaml. We parse only the shapes
 * this file declares (kind / schema_version / top-level sections with
 * "key: value" children) so we can avoid a yaml dependency in the kit's
 * consumer projects.
 */
function parseTokens(src: string): ParsedTokens {
  const out: ParsedTokens = { colors: {}, space: {}, radius: {} };

  let section: string | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const topLevel = line.match(/^([a-z_]+):\s*$/);
    if (topLevel) {
      section = topLevel[1] ?? null;
      continue;
    }
    if (!section) continue;

    const kv = line.match(/^\s+([a-z0-9_.]+):\s*(.+)$/i);
    if (!kv) continue;
    const key = (kv[1] ?? '').trim();
    const rawVal = (kv[2] ?? '').trim().replace(/^["']|["']$/g, '');

    if (section === 'colors') {
      const slot = TOKEN_KEY_MAP[key];
      if (slot) out.colors[slot] = rawVal;
    } else if (section === 'typography') {
      if (key === 'font.sans') out.fontSans = rawVal;
      else if (key === 'font.mono') out.fontMono = rawVal;
    } else if (section === 'spacing') {
      const m = key.match(/^space\.(\d)$/);
      if (m) {
        const n = Number(m[1]);
        if (n === 1 || n === 2 || n === 3 || n === 4 || n === 6 || n === 8) {
          out.space[n] = rawVal;
        }
      }
    } else if (section === 'radius') {
      const m = key.match(/^radius\.(sm|md|lg)$/);
      if (m) out.radius[m[1] as 'sm' | 'md' | 'lg'] = rawVal;
    }
  }
  return out;
}

function buildTheme(parsed: ParsedTokens): DevKitTheme {
  const colors: DevKitTheme['colors'] = { ...DEFAULT_COLORS, ...parsed.colors };
  const font: DevKitTheme['font'] = {
    sans: parsed.fontSans ?? DEFAULT_FONTS.sans,
    mono: parsed.fontMono ?? DEFAULT_FONTS.mono,
  };
  const spaceMap = { ...DEFAULT_SPACE, ...parsed.space };
  const radiusMap = { ...DEFAULT_RADII, ...parsed.radius };
  return {
    colors,
    font,
    space: (step) => spaceMap[step],
    radius: (size) => radiusMap[size],
  };
}

/**
 * Return the current project's theme. Safe to call from any server component.
 * Client components should receive the theme via props or a context seeded
 * on the server -- do NOT import this from a 'use client' module (it reads
 * the filesystem).
 */
export function getDevKitTheme(cwd: string = process.cwd()): DevKitTheme {
  const path = join(cwd, '.ai-dev-kit', 'registries', 'design-tokens.yaml');
  const cached = themeCache.get(path);
  if (cached) return cached;

  let theme: DevKitTheme;
  if (!existsSync(path)) {
    theme = buildTheme({ colors: {}, space: {}, radius: {} });
  } else {
    const src = readFileSync(path, 'utf-8');
    theme = buildTheme(parseTokens(src));
  }
  themeCache.set(path, theme);
  return theme;
}

/** Test-only helper. Resets the module cache so a test can swap tokens files. */
export function __resetDevKitThemeCache(): void {
  themeCache.clear();
}
