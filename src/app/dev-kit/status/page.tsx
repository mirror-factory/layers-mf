'use client';

/**
 * /dev-kit/status -- one page, full observability wiring state.
 *
 * Answers "is everything connected?" at a glance. Auto-refreshes every
 * 10 seconds. All data from GET /api/dev-kit/status (no billable calls).
 */

import { useEffect, useState } from 'react';

interface SinkStatus { sink: string; configured: boolean; note?: string }
interface RegistryStatus { vendor: string; validated_on: string; ageDays: number; modelCount: number; stale: boolean }
interface CoverageStatus { withRoute: number; withRouteTotal: number; withExternalCall: number; withExternalCallTotal: number; withTelemetry: number; withTelemetryTotal: number }
interface RunResult { kind: string; present: boolean; updatedAt?: string; path?: string }
interface StatusResponse {
  ts: string;
  sinks: SinkStatus[];
  registries: RegistryStatus[];
  coverage: CoverageStatus;
  runResults: RunResult[];
  warnings: string[];
  overall: 'ok' | 'degraded' | 'critical';
}

function Badge({ kind, children }: { kind: 'ok' | 'warn' | 'error' | 'info'; children: React.ReactNode }) {
  const color = kind === 'ok' ? '#22c55e' : kind === 'warn' ? '#f59e0b' : kind === 'error' ? '#ef4444' : '#888';
  return <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>{children}</span>;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/dev-kit/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const h = setInterval(load, 10_000);
    return () => clearInterval(h);
  }, []);

  if (err) return <div style={{ padding: 24 }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 24 }}>Loading&hellip;</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Observability Status</h1>
        <Badge kind={data.overall === 'ok' ? 'ok' : data.overall === 'degraded' ? 'warn' : 'error'}>
          {data.overall}
        </Badge>
        <span style={{ fontSize: 12, color: '#888' }}>last check {new Date(data.ts).toLocaleTimeString()}</span>
      </div>

      {data.warnings.length > 0 && (
        <div style={{ background: '#f59e0b22', border: '1px solid #f59e0b', borderRadius: 4, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Open warnings ({data.warnings.length})</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Sinks</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: '#888' }}><th>Sink</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>
            {data.sinks.map(s => (
              <tr key={s.sink} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{s.sink}</td>
                <td><Badge kind={s.configured ? 'ok' : 'info'}>{s.configured ? 'configured' : 'not configured'}</Badge></td>
                <td style={{ color: '#666' }}>{s.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Wrapper coverage</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: '#888' }}><th>Wrapper</th><th>Coverage</th><th>Status</th></tr></thead>
          <tbody>
            <tr style={{ borderTop: '1px solid #eee' }}><td style={{ padding: '6px 0', fontFamily: 'monospace' }}>withRoute</td><td>{data.coverage.withRoute} / {data.coverage.withRouteTotal}</td><td><Badge kind={data.coverage.withRoute === data.coverage.withRouteTotal ? 'ok' : 'warn'}>{data.coverage.withRoute === data.coverage.withRouteTotal ? 'full' : 'gaps'}</Badge></td></tr>
            <tr style={{ borderTop: '1px solid #eee' }}><td style={{ padding: '6px 0', fontFamily: 'monospace' }}>withExternalCall</td><td>{data.coverage.withExternalCall} / {data.coverage.withExternalCallTotal}</td><td><Badge kind={data.coverage.withExternalCall === data.coverage.withExternalCallTotal ? 'ok' : 'warn'}>{data.coverage.withExternalCall === data.coverage.withExternalCallTotal ? 'full' : 'gaps'}</Badge></td></tr>
            <tr style={{ borderTop: '1px solid #eee' }}><td style={{ padding: '6px 0', fontFamily: 'monospace' }}>withTelemetry / aiCall</td><td>{data.coverage.withTelemetry} / {data.coverage.withTelemetryTotal}</td><td><Badge kind={data.coverage.withTelemetry === data.coverage.withTelemetryTotal ? 'ok' : 'warn'}>{data.coverage.withTelemetry === data.coverage.withTelemetryTotal ? 'full' : 'gaps'}</Badge></td></tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Registries</h2>
        {data.registries.length === 0 ? (
          <p style={{ fontSize: 13, color: '#888' }}>No vendor registries yet. Run <code>ai-dev-kit registry add &lt;vendor&gt;</code>.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: '#888' }}><th>Vendor</th><th>Models</th><th>Validated</th><th>Status</th></tr></thead>
            <tbody>
              {data.registries.map(r => (
                <tr key={r.vendor} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{r.vendor}</td>
                  <td>{r.modelCount}</td>
                  <td>{r.validated_on} ({r.ageDays}d)</td>
                  <td><Badge kind={r.stale ? 'warn' : 'ok'}>{r.stale ? 'stale' : 'fresh'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Run results</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: '#888' }}><th>Kind</th><th>Present</th><th>Path</th><th>Updated</th></tr></thead>
          <tbody>
            {data.runResults.map(r => (
              <tr key={r.kind} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{r.kind}</td>
                <td><Badge kind={r.present ? 'ok' : 'info'}>{r.present ? 'yes' : 'no'}</Badge></td>
                <td style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>{r.path ?? ''}</td>
                <td style={{ color: '#666' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
