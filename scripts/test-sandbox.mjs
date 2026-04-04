#!/usr/bin/env node
/**
 * Sandbox Test CLI — tests the full sandbox pipeline independent of chat API.
 * Usage: node scripts/test-sandbox.mjs
 *
 * Tests: snapshot lookup → create VM → write files → npm install → start server → health check
 * Expected: ~3s with snapshot, ~20s cold build
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Sandbox, Snapshot } from '@vercel/sandbox';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)="(.*)"$/);
  if (m) process.env[m[1].trim()] = m[2];
});

const ORG_ID = 'addef77d-97b4-4760-bc80-127dc429f538';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FILES = [
  { path: 'package.json', content: JSON.stringify({ name: 'app', private: true, type: 'module', scripts: { dev: 'vite --host 0.0.0.0' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }, devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^5.0.0' } }) },
  { path: 'index.html', content: '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
  { path: 'vite.config.js', content: 'import{defineConfig}from"vite";import react from"@vitejs/plugin-react";export default defineConfig({plugins:[react()],server:{host:"0.0.0.0",allowedHosts:true}});' },
  { path: 'src/main.jsx', content: 'import React from"react";import ReactDOM from"react-dom/client";import App from"./App";ReactDOM.createRoot(document.getElementById("root")).render(<App/>);' },
  { path: 'src/App.jsx', content: 'import{useState}from"react";export default function App(){const[c,s]=useState(0);return <div style={{padding:40,textAlign:"center",fontFamily:"system-ui"}}><h1 style={{fontSize:48}}>Count: {c}</h1><button onClick={()=>s(c+1)} style={{padding:"12px 24px",fontSize:18,cursor:"pointer"}}>Increment</button></div>}' },
];

async function step(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`  ✓ ${name}: ${ms}ms${result ? ` — ${result}` : ''}`);
    return result;
  } catch (e) {
    const ms = Date.now() - start;
    console.error(`  ✗ ${name}: ${ms}ms — ${e.message}`);
    throw e;
  }
}

async function main() {
  const mode = process.argv[2] ?? 'test'; // test | snapshot | clean
  console.log(`\n🧪 Sandbox Test CLI (mode: ${mode})\n`);

  if (mode === 'clean') {
    const { data } = await supabase.from('sandbox_snapshots').select('snapshot_id').eq('org_id', ORG_ID);
    for (const s of data ?? []) {
      try { await (await Snapshot.get({ snapshotId: s.snapshot_id })).delete(); } catch {}
    }
    await supabase.from('sandbox_snapshots').delete().eq('org_id', ORG_ID);
    console.log('  Cleaned all snapshots');
    return;
  }

  if (mode === 'snapshot') {
    console.log('Creating fresh snapshot...');
    const sb = await step('Create VM', async () => {
      const s = await Sandbox.create({ runtime: 'node24', ports: [5173], timeout: 300000 });
      return s.sandboxId;
    });
    const sandbox = await Sandbox.get({ sandboxId: sb });
    await step('Write files', () => sandbox.writeFiles(FILES.map(f => ({ path: f.path, content: Buffer.from(f.content) }))));
    await step('npm install', async () => {
      const r = await sandbox.runCommand('npm', ['install']);
      return `exit ${r.exitCode}`;
    });
    const snap = await step('Snapshot', async () => {
      const s = await sandbox.snapshot({ expiration: 0 });
      return s.snapshotId;
    });
    await step('Save to DB', async () => {
      await supabase.from('sandbox_snapshots').insert({
        org_id: ORG_ID,
        snapshot_id: snap,
        name: 'cli-test',
        metadata: { files: FILES.map(f => f.path) },
        cpu_ms: 0, memory_mb_seconds: 0, network_ingress_bytes: 0, network_egress_bytes: 0, cost_usd: 0,
      });
      return snap;
    });
    console.log(`\n✅ Snapshot created: ${snap}\n`);
    return;
  }

  // Default: test full pipeline
  const totalStart = Date.now();

  const snapId = await step('Snapshot lookup', async () => {
    const { data } = await supabase.from('sandbox_snapshots').select('snapshot_id').eq('org_id', ORG_ID).order('created_at', { ascending: false }).limit(1).single();
    return data?.snapshot_id ?? 'NONE';
  });

  const hasSnap = snapId !== 'NONE';
  const createOpts = hasSnap
    ? { source: { type: 'snapshot', snapshotId: snapId }, ports: [5173], timeout: 300000 }
    : { runtime: 'node24', ports: [5173], timeout: 300000 };

  let sandbox;
  await step('Create VM' + (hasSnap ? ' (from snapshot)' : ' (fresh)'), async () => {
    sandbox = await Sandbox.create(createOpts);
    return sandbox.sandboxId;
  });

  await step('Write files', () => sandbox.writeFiles(FILES.map(f => ({ path: f.path, content: Buffer.from(f.content) }))));

  if (!hasSnap) {
    await step('npm install', async () => {
      const r = await sandbox.runCommand('npm', ['install']);
      return `exit ${r.exitCode}`;
    });
  } else {
    console.log('  ⏭ npm install: SKIPPED (snapshot)');
  }

  await step('Start dev server', () => sandbox.runCommand({ cmd: 'npm', args: ['run', 'dev'], detached: true }));

  const url = sandbox.domain(5173);
  console.log(`  📍 Preview: ${url}`);

  await step('Health check', async () => {
    for (let i = 0; i < 15; i++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (r.status !== 502) return `LIVE after ${(i + 1) * 1.5}s (HTTP ${r.status})`;
      } catch {}
      await new Promise(r => setTimeout(r, 1500));
    }
    return 'TIMED OUT';
  });

  const totalMs = Date.now() - totalStart;
  console.log(`\n✅ Total: ${(totalMs / 1000).toFixed(1)}s ${hasSnap ? '(warm)' : '(cold)'}\n`);

  await sandbox.stop();
}

main().catch(e => { console.error('\n❌ FATAL:', e.message); process.exit(1); });
