/**
 * Inline editor panel used by /dev-kit/design-system for the Tokens + System
 * spec sections. Toggles open from an "Edit" button; POSTs to
 * /api/dev-kit/config/[slug] just like the full /dev-kit/config editor.
 *
 * Kept in its own client module so the parent page can stay a server
 * component that reads YAML off disk for the initial render.
 */
'use client';

import { useState } from 'react';

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

export function InlineEditor({
  slug,
  label,
  initial,
  theme,
}: {
  slug: 'design-tokens' | 'design-system';
  label: string;
  initial: string;
  theme: SerializedTheme;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(initial);
  const dirty = draft !== baseline;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dev-kit/config/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; bytes?: number };
      if (!res.ok || !json.ok) {
        setError(json.message ?? `save failed (${res.status})`);
        return;
      }
      setBaseline(draft);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: theme.space[2] }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            padding: `${theme.space[1]} ${theme.space[3]}`,
            background: 'transparent',
            color: theme.colors.primary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            cursor: 'pointer',
            fontFamily: theme.font.sans,
            fontSize: 12,
          }}
        >
          {open ? 'Close editor' : `Edit ${label.toLowerCase()}`}
        </button>
      </div>

      {open ? (
        <div
          style={{
            marginTop: theme.space[2],
            padding: theme.space[3],
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
          }}
        >
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck={false}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 280,
              padding: theme.space[2],
              background: theme.colors.bg,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              fontFamily: theme.font.mono,
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {error ? (
            <p
              role="alert"
              style={{
                marginTop: theme.space[2],
                color: theme.colors.error,
                fontSize: 12,
              }}
            >
              {error}
            </p>
          ) : null}

          <div
            style={{
              marginTop: theme.space[2],
              display: 'flex',
              alignItems: 'center',
              gap: theme.space[3],
            }}
          >
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              style={{
                padding: `${theme.space[1]} ${theme.space[3]}`,
                background: saving || !dirty ? theme.colors.bg : theme.colors.primary,
                color: saving || !dirty ? theme.colors.textMuted : theme.colors.bg,
                border: `1px solid ${theme.colors.primary}`,
                borderRadius: theme.radius.sm,
                cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                fontFamily: theme.font.sans,
                fontSize: 12,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <span style={{ fontSize: 11, color: theme.colors.textMuted, fontFamily: theme.font.mono }}>
              {savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : dirty ? 'unsaved changes' : 'up to date'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
