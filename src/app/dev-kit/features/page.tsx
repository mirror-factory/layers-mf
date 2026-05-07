/**
 * /dev-kit/features -- list every feature in features/*.
 *
 * Click a row to drill into /dev-kit/features/[name].
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Feature { name: string; specExists: boolean; designReady: boolean; manifestExists: boolean; flows: number }

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/dev-kit/features').then(r => r.json()).then(d => { setFeatures(d.features ?? []); setLoading(false); });
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui', minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      <h1>Features</h1>
      <p style={{ color: '#94a3b8' }}>Each feature has its own SPEC + IA + TEST-MANIFEST + build history.</p>
      {loading ? <p>Loading...</p> : features.length === 0 ? (
        <div style={{ padding: 24, border: '1px dashed #333', marginTop: 20 }}>
          <p>No features yet.</p>
          <p style={{ color: '#94a3b8' }}>Create one: <code>mkdir -p features/my-feature &amp;&amp; cp templates/features/_SEED-SPEC.md features/my-feature/SPEC.md</code></p>
        </div>
      ) : (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>SPEC</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Design-ready</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Manifest</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Flows</th>
            </tr>
          </thead>
          <tbody>
            {features.map(f => (
              <tr key={f.name}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>
                  <Link href={`/dev-kit/features/${f.name}`}>{f.name}</Link>
                </td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.specExists ? 'yes' : 'no'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.designReady ? 'yes' : 'no'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.manifestExists ? 'yes' : 'no'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.flows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
