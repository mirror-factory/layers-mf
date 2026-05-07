/**
 * Client child for /dev-kit/runs. Owns the fetch + loading state; reads
 * every visual value off the server-provided theme so the grey/white
 * inline styling is gone and brand changes in design-tokens.yaml ripple
 * into the dashboard without edits here.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Run {
  run_id: string;
  feature_name: string | null;
  branch: string | null;
  started_at: string;
  ended_at?: string;
  status?: string;
  totals?: {
    ai_calls?: number;
    vendor_calls?: number;
    cost_usd?: number;
    tests_run?: number;
    iterations?: number;
  };
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

export function RunsList({ theme }: { theme: SerializedTheme }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/runs').then(r => r.json()).then(d => {
      setRuns(d.runs ?? []);
      setLoading(false);
    });
  }, []);

  const main: React.CSSProperties = {
    padding: theme.space[6],
    fontFamily: theme.font.sans,
    background: theme.colors.bg,
    color: theme.colors.text,
    minHeight: '100vh',
  };
  const muted: React.CSSProperties = { color: theme.colors.textMuted };
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: `${theme.space[2]} ${theme.space[3]}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };
  const td: React.CSSProperties = {
    padding: `${theme.space[2]} ${theme.space[3]}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  return (
    <main style={main}>
      <h1 style={{ margin: 0 }}>Runs</h1>
      <p style={muted}>Every feature build this project has recorded, newest first.</p>
      {loading ? <p style={muted}>Loading...</p> : runs.length === 0 ? (
        <p style={muted}>
          No runs yet. Start a Claude Code session or run{' '}
          <code style={{ fontFamily: theme.font.mono, background: theme.colors.surface, padding: `0 ${theme.space[1]}`, borderRadius: theme.radius.sm }}>
            ai-dev-kit run &lt;task&gt;
          </code>
          .
        </p>
      ) : (
        <div
          style={{
            marginTop: theme.space[4],
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Run</th>
                <th style={th}>Feature</th>
                <th style={th}>Branch</th>
                <th style={th}>Status</th>
                <th style={th}>Cost</th>
                <th style={th}>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.run_id}>
                  <td style={td}>
                    <Link
                      href={`/dev-kit/runs/${r.run_id}`}
                      style={{ color: theme.colors.primary, fontFamily: theme.font.mono }}
                    >
                      {r.run_id.slice(0, 16)}...
                    </Link>
                  </td>
                  <td style={td}>{r.feature_name ?? '-'}</td>
                  <td style={{ ...td, fontFamily: theme.font.mono, color: theme.colors.textMuted }}>{r.branch ?? '-'}</td>
                  <td style={td}>{r.status ?? (r.ended_at ? 'ended' : 'active')}</td>
                  <td style={td}>{r.totals?.cost_usd ? `$${r.totals.cost_usd.toFixed(4)}` : '-'}</td>
                  <td style={{ ...td, color: theme.colors.textMuted }}>{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
