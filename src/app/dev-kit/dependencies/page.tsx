/**
 * /dev-kit/dependencies -- vuln view of dependencies.yaml.
 */
import { getDevKitTheme } from '@/lib/dev-kit-theme';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export default function DependenciesPage() {
  const theme = getDevKitTheme();
  const path = join(process.cwd(), '.ai-dev-kit', 'registries', 'dependencies.yaml');
  const src = existsSync(path) ? readFileSync(path, 'utf-8') : '';

  return (
    <main style={{ padding: theme.space(6), background: theme.colors.bg, minHeight: '100vh', fontFamily: theme.font.sans }}>
      <header style={{ marginBottom: theme.space(4) }}>
        <h1 style={{ margin: 0, color: theme.colors.text }}>Dependencies</h1>
        <p style={{ color: theme.colors.textMuted, marginTop: theme.space(2) }}>
          Every runtime + dev dependency, refreshed weekly by GH Action.
          Pre-push fails on any CRITICAL or HIGH vulnerability.
        </p>
      </header>
      {src ? (
        <pre style={{ background: theme.colors.surface, color: theme.colors.text, padding: theme.space(3), borderRadius: theme.radius('sm'), fontFamily: theme.font.mono, fontSize: '0.78rem', overflow: 'auto', border: `1px solid ${theme.colors.border}` }}>{src}</pre>
      ) : (
        <div style={{ padding: theme.space(6), border: `1px dashed ${theme.colors.border}`, color: theme.colors.textMuted, borderRadius: theme.radius('md') }}>
          <p><strong style={{ color: theme.colors.text }}>Not audited yet.</strong></p>
          <p>Run: <code style={{ fontFamily: theme.font.mono }}>pnpm exec tsx scripts/sync-dependencies.ts</code></p>
        </div>
      )}
    </main>
  );
}
