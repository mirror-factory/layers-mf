/**
 * /dev-kit/design-system
 *
 * The project's design system rendered visually:
 *   - Tokens (colors / typography / spacing / radius / shadow / motion / z-index)
 *   - System spec (primitives / molecules / organisms / templates / patterns)
 *   - Component registry status (which components.yaml entries match primitives)
 *
 * Populated by @design-agent during `ai-dev-kit design <feature>`. Empty
 * state: link out to the concept doc + CLI command to run.
 */
import { getDevKitTheme, type DevKitTheme } from '@/lib/dev-kit-theme';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InlineEditor, type SerializedTheme } from './inline-editor';

export const dynamic = 'force-dynamic';

function serializeTheme(theme: DevKitTheme): SerializedTheme {
  return {
    colors: theme.colors,
    font: theme.font,
    space: {
      1: theme.space(1),
      2: theme.space(2),
      3: theme.space(3),
      4: theme.space(4),
      6: theme.space(6),
      8: theme.space(8),
    },
    radius: {
      sm: theme.radius('sm'),
      md: theme.radius('md'),
      lg: theme.radius('lg'),
    },
  };
}

function readYaml(path: string): string | null {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

export default function DesignSystemPage() {
  const theme = getDevKitTheme();
  const root = process.cwd();
  const tokensSrc = readYaml(join(root, '.ai-dev-kit', 'registries', 'design-tokens.yaml'));
  const systemSrc = readYaml(join(root, '.ai-dev-kit', 'registries', 'design-system.yaml'));
  const componentsSrc = readYaml(join(root, '.ai-dev-kit', 'registries', 'components.yaml'));

  const tokensPopulated = tokensSrc
    ? /^(colors|typography|spacing|radius|shadow|motion|elevation):/m.test(tokensSrc)
      && !/^(colors|typography|spacing):\s*\n(\s+#.*\n)*\s*$/m.test(tokensSrc)
    : false;
  const systemPopulated = systemSrc ? /^primitives:\s*\n\s+\w+/m.test(systemSrc) : false;
  const flatTheme = serializeTheme(theme);

  return (
    <main style={page(theme)}>
      <header style={{ marginBottom: theme.space(6) }}>
        <h1 style={{ margin: 0, color: theme.colors.text, fontFamily: theme.font.sans }}>
          Design system
        </h1>
        <p style={{ color: theme.colors.textMuted, fontFamily: theme.font.sans, marginTop: theme.space(2) }}>
          Tokens + component spec that every implementation must conform to. Populated by
          <code style={{ margin: '0 6px', fontFamily: theme.font.mono }}>@design-agent</code>
          and enforced by <code style={{ fontFamily: theme.font.mono }}>check-brand-tokens.ts</code> +
          <code style={{ margin: '0 6px', fontFamily: theme.font.mono }}>check-brand-compliance.mts</code>.
        </p>
      </header>

      {!tokensPopulated && !systemPopulated ? (
        <EmptyState theme={theme} />
      ) : (
        <>
          <Section title="Tokens" theme={theme} populated={tokensPopulated}>
            <InlineEditor
              slug="design-tokens"
              label="tokens"
              initial={tokensSrc ?? ''}
              theme={flatTheme}
            />
            <YamlBlock src={tokensSrc ?? '# design-tokens.yaml not present'} theme={theme} />
            <TokenPreview src={tokensSrc ?? ''} theme={theme} />
          </Section>

          <Section title="System spec" theme={theme} populated={systemPopulated}>
            <InlineEditor
              slug="design-system"
              label="system spec"
              initial={systemSrc ?? ''}
              theme={flatTheme}
            />
            <YamlBlock src={systemSrc ?? '# design-system.yaml not present'} theme={theme} />
          </Section>

          <Section title="Component registry" theme={theme} populated={!!componentsSrc}>
            <YamlBlock src={componentsSrc ?? '# components.yaml not present -- run sync-registries'} theme={theme} />
          </Section>
        </>
      )}
    </main>
  );
}

function EmptyState({ theme }: { theme: DevKitTheme }) {
  return (
    <div style={{
      padding: theme.space(6),
      border: `1px dashed ${theme.colors.border}`,
      borderRadius: theme.radius('md'),
      color: theme.colors.textMuted,
      fontFamily: theme.font.sans,
    }}>
      <p><strong style={{ color: theme.colors.text }}>No design system yet.</strong></p>
      <p>Populate in two ways:</p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Run <code style={{ fontFamily: theme.font.mono }}>ai-dev-kit design &lt;feature&gt;</code> and invoke <code>@design-agent</code> in Claude Code.</li>
        <li>Or hand-edit <code>.ai-dev-kit/registries/design-tokens.yaml</code> and <code>.ai-dev-kit/registries/design-system.yaml</code>.</li>
      </ul>
      <p>
        See <code style={{ fontFamily: theme.font.mono }}>docs/concepts/design-first.md</code> for the full workflow.
      </p>
    </div>
  );
}

function Section({
  title, populated, theme, children,
}: { title: string; populated: boolean; theme: DevKitTheme; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: theme.space(6) }}>
      <h2 style={{
        color: theme.colors.text,
        fontFamily: theme.font.sans,
        fontSize: '1.1rem',
        margin: `0 0 ${theme.space(3)} 0`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.space(2),
      }}>
        {title}
        <span style={{
          fontSize: '0.7rem',
          color: populated ? theme.colors.success : theme.colors.warn,
          fontWeight: 400,
        }}>
          {populated ? 'populated' : 'empty'}
        </span>
      </h2>
      {children}
    </section>
  );
}

function YamlBlock({ src, theme }: { src: string; theme: DevKitTheme }) {
  return (
    <pre style={{
      background: theme.colors.surface,
      color: theme.colors.text,
      padding: theme.space(3),
      borderRadius: theme.radius('sm'),
      border: `1px solid ${theme.colors.border}`,
      fontFamily: theme.font.mono,
      fontSize: '0.78rem',
      maxHeight: 320,
      overflow: 'auto',
      margin: 0,
    }}>
      {src}
    </pre>
  );
}

function TokenPreview({ src, theme }: { src: string; theme: DevKitTheme }) {
  // Extract declared colors and render as swatches. Minimal parse: look for
  // `key: "value"` or `key: value` under the `colors:` section.
  const swatches: Array<{ name: string; value: string }> = [];
  let inColors = false;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    if (/^colors:\s*$/.test(line)) { inColors = true; continue; }
    if (inColors && /^[a-z_]+:/.test(line) && !/^colors:/.test(line)) { inColors = false; }
    if (!inColors) continue;
    const m = line.match(/^\s+([a-z0-9.]+):\s*"?(#[0-9a-fA-F]+|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))"?/);
    if (m) swatches.push({ name: m[1], value: m[2] });
  }

  if (swatches.length === 0) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: theme.space(2),
      marginTop: theme.space(3),
    }}>
      {swatches.map((s) => (
        <div key={s.name} style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius('sm'),
          overflow: 'hidden',
        }}>
          <div style={{ background: s.value, height: 48 }} />
          <div style={{
            padding: theme.space(2),
            fontFamily: theme.font.mono,
            fontSize: '0.72rem',
            color: theme.colors.text,
          }}>
            <div>{s.name}</div>
            <div style={{ color: theme.colors.textMuted }}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function page(theme: DevKitTheme): React.CSSProperties {
  return {
    padding: theme.space(6),
    background: theme.colors.bg,
    minHeight: '100vh',
    fontFamily: theme.font.sans,
  };
}
