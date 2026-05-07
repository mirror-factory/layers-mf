/**
 * Shared types for registry views.
 *
 * `/api/dev-kit/registries` emits a heterogeneous list of registries. Each
 * registry has the same envelope (`kind`, `path`, `last_synced_on`, ...) but
 * its `entries` payload varies per kind.
 *
 * The envelope is typed via `RegistryEnvelope`. Per-kind entry shapes live in
 * their own interfaces so the per-tab view components can narrow via the
 * `kind` tag rather than sprinkling `any` around.
 *
 * Only the fields the dashboard actually renders are typed; unknown fields on
 * entries flow through as `Record<string, unknown>`.
 */

export type RegistryKind =
  | 'components'
  | 'pages'
  | 'api-routes'
  | 'tools'
  | 'skills'
  | 'mcp-servers'
  | 'hooks'
  | 'docs'
  | 'tests'
  | 'design-tokens'
  | 'design-system'
  | 'dependencies'
  | 'test-contracts'
  | 'index'
  | 'vendor';

export interface RegistryEnvelope<E = Record<string, unknown>> {
  kind: string; // widened from RegistryKind -- API may ship kinds we don't render yet
  path: string;
  schema_version?: number;
  last_synced_on: string | null;
  entries_count: number;
  entries: E[];
  parse_error?: string;
  // Vendor-only extras
  vendor?: string;
  label?: string;
  docs_root?: string;
  console_url?: string;
  validated_on?: string;
  ageDays?: number;
  stale?: boolean;
  required_env?: string[];
  deprecations?: Array<{
    pattern: string;
    deprecated_on: string;
    replacement: string;
    notes?: string;
  }>;
  slots?: Record<string, ModelEntry[]>;
}

export interface ModelEntry {
  id: string;
  label?: string;
  description?: string;
  price_per_hour_usd?: number;
  input_price_per_million_usd?: number;
  output_price_per_million_usd?: number;
  price_per_million_chars_usd?: number;
  price_notes?: string;
  use_for?: string;
  context_window?: number;
  deprecated?: boolean;
}

export interface ComponentEntry {
  name?: string;
  path?: string;
  stories_path?: string | null;
  visual_path?: string | null;
  owner?: string;
  status?: string;
}

export interface PageEntry {
  route?: string;
  path?: string;
  owner?: string;
  auth?: string;
  features?: string;
}

export interface ApiRouteEntry {
  id?: string;
  route?: string;
  method?: string;
  path?: string;
  owner?: string;
  auth?: string;
  description?: string;
}

export interface ToolEntry {
  name?: string;
  path?: string;
  description?: string;
  has_test?: boolean;
  owner?: string;
}

export interface SkillEntry {
  name?: string;
  path?: string;
  description?: string;
  invocation_count?: number;
  last_invoked_at?: string | null;
  last_run_id?: string | null;
}

export interface McpServerEntry {
  name?: string;
  command?: string;
  args?: string;
  required_env?: string;
  used_by?: string;
  description?: string;
}

export interface HookEntry {
  name?: string;
  surface?: string; // 'husky' | 'claude'
  event?: string;
  path?: string;
  wired_in_settings?: boolean;
  kit_audit_instrumented?: boolean;
  tool_filter?: string;
  last_modified?: string | null;
}

export interface DocEntry {
  path?: string;
  category?: string;
  word_count?: number;
  inbound_links?: number;
  outbound_links_broken?: number;
  last_modified?: string | null;
}

export interface TestEntry {
  path?: string;
  feature?: string | null;
  last_modified?: string | null;
  last_run?: string | null;
  last_duration_ms?: number | null;
  last_outcome?: string | null;
}

/**
 * Color palette lifted from the dashboard layout so views stay consistent.
 */
export const palette = {
  bg: '#050505',
  surface: '#0c0c0c',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#f0f0f0',
  textMuted: 'rgba(240,240,240,0.55)',
  textFaint: 'rgba(240,240,240,0.35)',
  primary: '#3dffc0',
  warn: '#f59e0b',
  error: '#ef4444',
  ok: '#22c55e',
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export function emptyStateCopy(kind: string): string {
  return `No ${kind} registered yet -- run \`pnpm exec tsx scripts/sync-registries.ts\``;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
