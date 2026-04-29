/**
 * /dev-kit/index -- top-level project graph. Registry of registries.
 *
 * Reads .ai-dev-kit/registries/index.yaml and renders the full project
 * map: features, registries, 30d totals. Same data the agent sees at
 * SessionStart via the compressed AGENTS.md block.
 */
import { getDevKitTheme, type DevKitTheme } from '@/lib/dev-kit-theme';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export default function ProjectIndexPage() {
  const theme = getDevKitTheme();
  const path = join(process.cwd(), '.ai-dev-kit', 'registries', 'index.yaml');
  const src = existsSync(path) ? readFileSync(path, 'utf-8') : '';

  return (
    <main style={{ padding: theme.space(6), background: theme.colors.bg, minHeight: '100vh', fontFamily: theme.font.sans }}>
      <header style={{ marginBottom: theme.space(4) }}>
        <h1 style={{ margin: 0, color: theme.colors.text }}>Project index</h1>
        <p style={{ color: theme.colors.textMuted, marginTop: theme.space(2) }}>
          Top-level map. Every feature, every registry, every 30-day metric. Auto-synced on pre-commit.
          Same data the agent sees at SessionStart via AGENTS.md&#39;s compressed block.
        </p>
      </header>
      {src ? (
        <pre style={{ background: theme.colors.surface, color: theme.colors.text, padding: theme.space(3), borderRadius: theme.radius('sm'), fontFamily: theme.font.mono, fontSize: '0.8rem', overflow: 'auto', border: `1px solid ${theme.colors.border}` }}>
          {src}
        </pre>
      ) : (
        <div style={{ padding: theme.space(6), border: `1px dashed ${theme.colors.border}`, color: theme.colors.textMuted, borderRadius: theme.radius('md') }}>
          <p><strong style={{ color: theme.colors.text }}>Index not generated yet.</strong></p>
          <p>Run: <code style={{ fontFamily: theme.font.mono }}>pnpm exec tsx scripts/sync-project-index.ts</code></p>
        </div>
      )}
    </main>
  );
}
