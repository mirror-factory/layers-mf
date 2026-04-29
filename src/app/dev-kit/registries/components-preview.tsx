/**
 * Components tab embed -- renders a live Storybook iframe for a single
 * component entry in .ai-dev-kit/registries/components.yaml.
 *
 * Wiring:
 *   Storybook serves per-story iframes at `/iframe.html?id=<story-id>`.
 *   Our components.yaml entries carry `stories_path` like
 *   `components/Button.stories.tsx`. The story id Storybook generates from
 *   that path follows the default naming convention: lower-kebab the file
 *   basename, drop ".stories". Callers can also pass `story_id` explicitly
 *   when the convention doesn't match.
 *
 * When `stories_path` is null/undefined the component shows a subtle
 * placeholder plus a link template for creating the story -- no iframe is
 * mounted, avoiding a broken preview that masquerades as coverage.
 *
 * TODO: wire this into `templates/dashboard/registries/page.tsx` -- the
 * Components tab currently prints a static entry list. Import and render
 * <ComponentsPreview ... /> when the selected component has stories_path.
 */
'use client';

import { useMemo } from 'react';

export interface ComponentsPreviewProps {
  /** Relative path from repo root, e.g. "components/Button.stories.tsx". May be null. */
  stories_path: string | null | undefined;
  /** Optional override when Storybook's auto-generated id doesn't match. */
  story_id?: string;
  /** Storybook dev-server origin. Defaults to http://localhost:6006. */
  storybook_url?: string;
  /** Iframe display height. Defaults to 420px. */
  height?: number | string;
  /** Used to style the placeholder in project brand. Optional; falls back to CSS defaults. */
  theme?: {
    colors: { textMuted: string; border: string; surface: string; primary: string };
    font: { sans: string; mono: string };
    space: Record<1 | 2 | 3 | 4 | 6 | 8, string>;
    radius: Record<'sm' | 'md' | 'lg', string>;
  };
}

/** Storybook default: drop `.stories.tsx`, lower-kebab the basename. */
function deriveStoryId(stories_path: string): string {
  const base = stories_path.split('/').pop() ?? stories_path;
  return base
    .replace(/\.stories\.(tsx?|jsx?|mdx)$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function ComponentsPreview({
  stories_path,
  story_id,
  storybook_url = 'http://localhost:6006',
  height = 420,
  theme,
}: ComponentsPreviewProps) {
  const resolved = useMemo(() => {
    if (!stories_path) return null;
    const id = story_id ?? deriveStoryId(stories_path);
    return `${storybook_url.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
  }, [stories_path, story_id, storybook_url]);

  if (!resolved) {
    const wrapStyle: React.CSSProperties = theme
      ? {
          padding: theme.space[4],
          border: `1px dashed ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          background: theme.colors.surface,
          color: theme.colors.textMuted,
          fontFamily: theme.font.sans,
        }
      : { padding: 16, border: '1px dashed #444', borderRadius: 6, color: '#888' };
    const linkStyle: React.CSSProperties = theme
      ? { color: theme.colors.primary, fontFamily: theme.font.mono }
      : { color: 'inherit' };
    return (
      <div style={wrapStyle}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>No Storybook story</div>
        <div style={{ fontSize: 12 }}>
          Create one alongside the component:{' '}
          <a
            href="https://storybook.js.org/docs/writing-stories"
            target="_blank"
            rel="noreferrer"
            style={linkStyle}
          >
            storybook.js.org/docs/writing-stories
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={resolved}
      title={story_id ?? stories_path ?? 'component preview'}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        border: theme ? `1px solid ${theme.colors.border}` : '1px solid #333',
        borderRadius: theme ? theme.radius.md : 6,
        background: theme ? theme.colors.surface : 'transparent',
      }}
      // Storybook iframes can navigate between stories; sandbox permissively so
      // the preview can run scripts + fetch its own assets.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
