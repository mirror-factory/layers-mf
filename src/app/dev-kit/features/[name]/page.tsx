/**
 * /dev-kit/features/[name] -- single feature drill-down.
 *
 * Shows SPEC + IA + TEST-MANIFEST alongside design-ready status.
 */
'use client';
import { useEffect, useState } from 'react';

interface Data { name: string; spec: string | null; ia: string | null; manifest: string | null; design_ready: boolean }

export default function FeaturePage({ params }: { params: Promise<{ name: string }> }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    (async () => {
      const p = await params;
      const res = await fetch(`/api/dev-kit/features/${p.name}`);
      setData(await res.json());
    })();
  }, [params]);

  if (!data) return <main style={{ padding: 24, color: '#fafafa', background: '#0a0a0a', minHeight: '100vh' }}>Loading...</main>;

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui', minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      <h1>{data.name}</h1>
      <p style={{ color: '#94a3b8' }}>Design-ready: {data.design_ready ? 'yes' : 'no'}</p>
      <section style={{ marginTop: 24 }}>
        <h2>SPEC.md</h2>
        {data.spec ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.spec}</pre> : <p style={{ color: '#94a3b8' }}>Not present.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>IA.md</h2>
        {data.ia ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.ia}</pre> : <p style={{ color: '#94a3b8' }}>Not present.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>TEST-MANIFEST.yaml</h2>
        {data.manifest ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.manifest}</pre> : <p style={{ color: '#94a3b8' }}>Not present. Run: <code>ai-dev-kit manifest seed {data.name}</code></p>}
      </section>
    </main>
  );
}
