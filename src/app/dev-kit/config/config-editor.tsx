/**
 * Client child for /dev-kit/config. One tab per editable YAML file; each tab
 * owns a textarea + Save/Revert controls + last-saved status.
 *
 * State model:
 *   - `initial[slug]` holds the last value we know the server accepted
 *     (seeded by the GET /api/dev-kit/config fetch, updated on Save).
 *   - `draft[slug]` holds what the user is typing. Revert copies initial
 *     back into draft.
 *   - `status[slug]` carries { savedAt, bytes, error } for the status line.
 *
 * Optimistic UI: on Save we send the POST and only update initial +
 * savedAt when the server returns ok. On error we keep draft as-is and
 * render the error in red above the Save button so the user can retry.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';

interface SlugEntry {
  slug: string;
  path: string;
  label: string;
}

export interface SerializedTheme {
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
  font: { sans: string; mono: string };
  space: Record<1 | 2 | 3 | 4 | 6 | 8, string>;
  radius: Record<'sm' | 'md' | 'lg', string>;
}

interface FileEntry {
  slug: string;
  path: string;
  exists: boolean;
  content: string | null;
  bytes: number;
}

interface FileStatus {
  savedAt: string | null;
  bytes: number;
  error: string | null;
  saving: boolean;
}

export function ConfigEditor({
  theme,
  slugs,
}: {
  theme: SerializedTheme;
  slugs: SlugEntry[];
}) {
  const [activeSlug, setActiveSlug] = useState<string>(slugs[0]?.slug ?? '');
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, FileStatus>>(() => {
    const out: Record<string, FileStatus> = {};
    for (const s of slugs) {
      out[s.slug] = { savedAt: null, bytes: 0, error: null, saving: false };
    }
    return out;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/dev-kit/config')
      .then(r => r.json())
      .then((d: { files?: FileEntry[] }) => {
        if (!alive) return;
        const files = d.files ?? [];
        const nextInitial: Record<string, string> = {};
        const nextStatus: Record<string, FileStatus> = { ...status };
        for (const f of files) {
          const value = f.content ?? '';
          nextInitial[f.slug] = value;
          nextStatus[f.slug] = {
            savedAt: null,
            bytes: f.bytes,
            error: f.exists ? null : 'file does not exist yet; saving will create it',
            saving: false,
          };
        }
        setInitial(nextInitial);
        setDraft(nextInitial);
        setStatus(nextStatus);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => slugs.find(s => s.slug === activeSlug) ?? slugs[0],
    [slugs, activeSlug],
  );

  async function save(slug: string) {
    const body = draft[slug] ?? '';
    setStatus(prev => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? emptyStatus()), saving: true, error: null },
    }));
    try {
      const res = await fetch(`/api/dev-kit/config/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: body }),
      });
      const json = (await res.json()) as { ok?: boolean; bytes?: number; message?: string };
      if (!res.ok || !json.ok) {
        setStatus(prev => ({
          ...prev,
          [slug]: {
            ...(prev[slug] ?? emptyStatus()),
            saving: false,
            error: json.message ?? `save failed (${res.status})`,
          },
        }));
        return;
      }
      setInitial(prev => ({ ...prev, [slug]: body }));
      setStatus(prev => ({
        ...prev,
        [slug]: {
          savedAt: new Date().toISOString(),
          bytes: json.bytes ?? body.length,
          error: null,
          saving: false,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(prev => ({
        ...prev,
        [slug]: { ...(prev[slug] ?? emptyStatus()), saving: false, error: message },
      }));
    }
  }

  function revert(slug: string) {
    setDraft(prev => ({ ...prev, [slug]: initial[slug] ?? '' }));
    setStatus(prev => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? emptyStatus()), error: null },
    }));
  }

  const page: React.CSSProperties = {
    padding: theme.space[6],
    background: theme.colors.bg,
    color: theme.colors.text,
    fontFamily: theme.font.sans,
    minHeight: '100vh',
  };
  const muted: React.CSSProperties = { color: theme.colors.textMuted };
  const tabRow: React.CSSProperties = {
    display: 'flex',
    gap: theme.space[1],
    flexWrap: 'wrap',
    marginTop: theme.space[4],
    marginBottom: theme.space[4],
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  if (!active) {
    return (
      <main style={page}>
        <p style={muted}>No editable configs declared.</p>
      </main>
    );
  }

  const activeDraft = draft[active.slug] ?? '';
  const activeInitial = initial[active.slug] ?? '';
  const activeStatus = status[active.slug] ?? emptyStatus();
  const dirty = activeDraft !== activeInitial;

  return (
    <main style={page}>
      <header>
        <h1 style={{ margin: 0 }}>Config</h1>
        <p style={muted}>
          Edit the project-level YAML configs that the kit treats as sources of truth.
          Changes write directly to disk under <code style={codeStyle(theme)}>.ai-dev-kit/</code>.
        </p>
      </header>

      <Banner theme={theme} />

      {loading ? (
        <p style={muted}>Loading...</p>
      ) : (
        <>
          <nav style={tabRow} aria-label="Editable configs">
            {slugs.map(s => {
              const isActive = s.slug === active.slug;
              const st = status[s.slug];
              const hasError = !!st?.error;
              const tabStyle: React.CSSProperties = {
                padding: `${theme.space[2]} ${theme.space[3]}`,
                background: isActive ? theme.colors.surface : 'transparent',
                color: isActive ? theme.colors.text : theme.colors.textMuted,
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${theme.colors.primary}`
                  : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: theme.font.sans,
                fontSize: 13,
              };
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setActiveSlug(s.slug)}
                  style={tabStyle}
                >
                  {s.label}
                  {hasError ? (
                    <span style={{ marginLeft: theme.space[1], color: theme.colors.error }}>
                      !
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.colors.textMuted }}>
            {active.path}
          </div>

          <textarea
            value={activeDraft}
            onChange={e => setDraft(prev => ({ ...prev, [active.slug]: e.target.value }))}
            spellCheck={false}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 420,
              marginTop: theme.space[2],
              padding: theme.space[3],
              background: theme.colors.surface,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              fontFamily: theme.font.mono,
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {activeStatus.error ? (
            <p
              role="alert"
              style={{
                marginTop: theme.space[2],
                padding: `${theme.space[2]} ${theme.space[3]}`,
                color: theme.colors.error,
                border: `1px solid ${theme.colors.error}`,
                borderRadius: theme.radius.sm,
                fontSize: 13,
              }}
            >
              {activeStatus.error}
            </p>
          ) : null}

          <div
            style={{
              marginTop: theme.space[3],
              display: 'flex',
              alignItems: 'center',
              gap: theme.space[3],
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => save(active.slug)}
              disabled={activeStatus.saving || !dirty}
              style={primaryButton(theme, activeStatus.saving || !dirty)}
            >
              {activeStatus.saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => revert(active.slug)}
              disabled={!dirty || activeStatus.saving}
              style={secondaryButton(theme, !dirty || activeStatus.saving)}
            >
              Revert
            </button>
            <span style={{ ...muted, fontSize: 12, fontFamily: theme.font.mono }}>
              {activeStatus.savedAt
                ? `saved ${new Date(activeStatus.savedAt).toLocaleTimeString()} (${activeStatus.bytes} B)`
                : `${utf8ByteLength(activeDraft)} B draft`}
              {dirty ? ` - unsaved changes` : ''}
            </span>
          </div>
        </>
      )}
    </main>
  );
}

function emptyStatus(): FileStatus {
  return { savedAt: null, bytes: 0, error: null, saving: false };
}

// Browser-safe byte count. TextEncoder is available in every runtime that
// Next.js targets for `use client` modules.
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function Banner({ theme }: { theme: SerializedTheme }) {
  return (
    <div
      style={{
        marginTop: theme.space[4],
        padding: `${theme.space[3]} ${theme.space[4]}`,
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.warn}`,
        borderRadius: theme.radius.sm,
        color: theme.colors.text,
        fontSize: 13,
      }}
    >
      <strong style={{ color: theme.colors.warn }}>Heads up:</strong>{' '}
      Edits here write to YAML on disk. Re-run{' '}
      <code style={codeStyle(theme)}>ai-dev-kit onboard</code> or the next pre-commit
      to propagate to downstream (tokens.css regenerates, AGENTS.md refreshes, etc.).
    </div>
  );
}

function codeStyle(theme: SerializedTheme): React.CSSProperties {
  return {
    fontFamily: theme.font.mono,
    background: theme.colors.bg,
    padding: `0 ${theme.space[1]}`,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
  };
}

function primaryButton(theme: SerializedTheme, disabled: boolean): React.CSSProperties {
  return {
    padding: `${theme.space[2]} ${theme.space[4]}`,
    background: disabled ? theme.colors.surface : theme.colors.primary,
    color: disabled ? theme.colors.textMuted : theme.colors.bg,
    border: `1px solid ${disabled ? theme.colors.border : theme.colors.primary}`,
    borderRadius: theme.radius.sm,
    fontFamily: theme.font.sans,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function secondaryButton(theme: SerializedTheme, disabled: boolean): React.CSSProperties {
  return {
    padding: `${theme.space[2]} ${theme.space[4]}`,
    background: 'transparent',
    color: disabled ? theme.colors.textMuted : theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    fontFamily: theme.font.sans,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
