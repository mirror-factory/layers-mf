/**
 * Client child for /dev-kit/runs/[run_id]. Owns tab state + the one fetch
 * against /api/dev-kit/runs/[run_id]. Every visual value reads from the
 * server-provided theme so the page adapts to design-tokens.yaml edits
 * without touching this file.
 */
'use client';

import { useEffect, useState } from 'react';
import type { SerializedTheme } from '../runs-list';

interface RunData {
  meta: {
    run_id: string;
    feature_name: string | null;
    branch: string | null;
    task: string | null;
    started_at: string;
    ended_at?: string;
    status?: string;
  };
  totals: {
    ai_calls: number;
    vendor_calls: number;
    docs_lookups: number;
    skill_invocations: number;
    tests: number;
    llm_cost_usd: number;
    vendor_cost_usd: number;
    total_cost_usd: number;
  };
  ai_calls: Array<Record<string, unknown>>;
  vendor_calls: Array<Record<string, unknown>>;
  docs_lookups: Array<Record<string, unknown>>;
  skill_invocations: Array<Record<string, unknown>>;
  tests: Array<Record<string, unknown>>;
  verifications: Record<string, unknown> | null;
}

type Tab = 'summary' | 'ai' | 'vendors' | 'docs' | 'skills' | 'tests' | 'verifications';

export function RunView({
  params,
  theme,
}: {
  params: Promise<{ run_id: string }>;
  theme: SerializedTheme;
}) {
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce(runId: string) {
      try {
        const res = await fetch(`/api/dev-kit/runs/${runId}`, { cache: 'no-store' });
        if (!res.ok) { if (!cancelled) setError(`HTTP ${res.status}`); return null; }
        const json = (await res.json()) as RunData;
        if (cancelled) return null;
        setData(json);
        return json;
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
        return null;
      }
    }

    (async () => {
      const p = await params;
      const json = await fetchOnce(p.run_id);
      // Poll every 2s while the run is still active. Stop as soon as
      // meta.ended_at lands (final state). Polling is intentionally simple
      // -- no SSE, no websocket; writes are infrequent enough that 2s is fine.
      const active = json && !json.meta.ended_at;
      if (active) {
        setLive(true);
        const tick = async () => {
          const next = await fetchOnce(p.run_id);
          if (cancelled) return;
          if (next && !next.meta.ended_at) {
            timer = setTimeout(tick, 2000);
          } else {
            setLive(false);
          }
        };
        timer = setTimeout(tick, 2000);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params]);

  const main: React.CSSProperties = {
    padding: theme.space[6],
    fontFamily: theme.font.sans,
    background: theme.colors.bg,
    color: theme.colors.text,
    minHeight: '100vh',
  };

  if (error) {
    return (
      <main style={main}>
        <p style={{ color: theme.colors.error }}>Error: {error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={main}>
        <p style={{ color: theme.colors.textMuted }}>Loading...</p>
      </main>
    );
  }

  const t = data.totals;

  return (
    <main style={main}>
      <header>
        <h1 style={{ marginBottom: theme.space[1], marginTop: 0, display: 'flex', alignItems: 'center', gap: theme.space[3] }}>
          Run <span style={{ fontFamily: theme.font.mono, color: theme.colors.primary }}>{data.meta.run_id}</span>
          {live && (
            <span style={{
              fontSize: '0.65rem',
              padding: `2px ${theme.space[2]}`,
              background: theme.colors.success,
              color: '#0b0c10',
              borderRadius: theme.radius.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: 600,
            }}>LIVE . 2s</span>
          )}
        </h1>
        <p style={{ color: theme.colors.textMuted, marginTop: 0 }}>
          {data.meta.feature_name ? `${data.meta.feature_name} . ` : ''}
          {data.meta.branch ?? '-'} . {data.meta.status ?? 'active'}
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: theme.space[3],
          borderBottom: `1px solid ${theme.colors.border}`,
          paddingBottom: theme.space[2],
          marginTop: theme.space[4],
        }}
      >
        {(['summary', 'ai', 'vendors', 'docs', 'skills', 'tests', 'verifications'] as Tab[]).map(k => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: `${theme.space[1]} ${theme.space[3]}`,
                border: `1px solid ${active ? theme.colors.primary : 'transparent'}`,
                background: active ? theme.colors.surface : 'transparent',
                color: active ? theme.colors.primary : theme.colors.textMuted,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
                fontWeight: active ? 600 : 400,
                borderRadius: theme.radius.sm,
              }}
            >
              {k}
              {k === 'ai' && ` (${t.ai_calls})`}
              {k === 'vendors' && ` (${t.vendor_calls})`}
              {k === 'docs' && ` (${t.docs_lookups})`}
              {k === 'skills' && ` (${t.skill_invocations})`}
              {k === 'tests' && ` (${t.tests})`}
            </button>
          );
        })}
      </nav>

      <section style={{ marginTop: theme.space[4] }}>
        {tab === 'summary' && <Summary data={data} theme={theme} />}
        {tab === 'ai' && <Table rows={data.ai_calls} theme={theme} />}
        {tab === 'vendors' && <Table rows={data.vendor_calls} theme={theme} />}
        {tab === 'docs' && <Table rows={data.docs_lookups} theme={theme} />}
        {tab === 'skills' && <Table rows={data.skill_invocations} theme={theme} />}
        {tab === 'tests' && <Table rows={data.tests} theme={theme} />}
        {tab === 'verifications' && (
          <pre
            style={{
              background: theme.colors.surface,
              color: theme.colors.text,
              padding: theme.space[3],
              overflow: 'auto',
              fontFamily: theme.font.mono,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            {JSON.stringify(data.verifications, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

function Summary({ data, theme }: { data: RunData; theme: SerializedTheme }) {
  const t = data.totals;
  const fmt = (n: number) => `$${n.toFixed(4)}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: theme.space[3],
      }}
    >
      <Card theme={theme} label="AI calls" value={String(t.ai_calls)} />
      <Card theme={theme} label="Vendor calls" value={String(t.vendor_calls)} />
      <Card theme={theme} label="Docs consulted" value={String(t.docs_lookups)} />
      <Card theme={theme} label="Skills invoked" value={String(t.skill_invocations)} />
      <Card theme={theme} label="Tests recorded" value={String(t.tests)} />
      <Card theme={theme} label="LLM cost" value={fmt(t.llm_cost_usd)} />
      <Card theme={theme} label="Vendor cost" value={fmt(t.vendor_cost_usd)} />
      <Card theme={theme} label="Total cost" value={fmt(t.total_cost_usd)} bold />
      <Card theme={theme} label="Task" value={data.meta.task ?? '-'} wide />
    </div>
  );
}

function Card({
  theme,
  label,
  value,
  bold,
  wide,
}: {
  theme: SerializedTheme;
  label: string;
  value: string;
  bold?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        padding: theme.space[3],
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
        borderRadius: theme.radius.md,
        gridColumn: wide ? '1 / -1' : undefined,
      }}
    >
      <div
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: bold ? 24 : 18,
          fontWeight: bold ? 700 : 500,
          marginTop: theme.space[1],
          color: bold ? theme.colors.primary : theme.colors.text,
          fontFamily: bold ? theme.font.mono : theme.font.sans,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Table({ rows, theme }: { rows: Array<Record<string, unknown>>; theme: SerializedTheme }) {
  if (rows.length === 0) {
    return <p style={{ color: theme.colors.textMuted }}>No entries.</p>;
  }
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).slice(0, 8);
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: `${theme.space[1]} ${theme.space[3]}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };
  const td: React.CSSProperties = {
    padding: `${theme.space[1]} ${theme.space[3]}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: theme.font.mono,
  };
  return (
    <div
      style={{
        overflow: 'auto',
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {keys.map(k => (
              <th key={k} style={th}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map(k => {
                const v = r[k];
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
                return <td key={k} style={td}>{s}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
