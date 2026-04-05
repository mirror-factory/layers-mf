import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

// In-memory store for the demo sandbox (per-process)
let activeSandbox: {
  sandbox: Sandbox;
  sandboxId: string;
  previewUrl: string;
  status: string;
  createdAt: number;
} | null = null;

const DEMO_FILES = [
  {
    path: "package.json",
    content: JSON.stringify(
      {
        name: "granger-sandbox-demo",
        private: true,
        type: "module",
        scripts: { dev: "vite --host 0.0.0.0 --port 5173" },
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
        devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.0.0" },
      },
      null,
      2,
    ),
  },
  {
    path: "vite.config.js",
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});
`,
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Granger Sandbox Demo</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`,
  },
  {
    path: "src/main.jsx",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  },
  {
    path: "src/App.jsx",
    content: `import React, { useState, useEffect } from 'react';

const COLORS = ['#34d399', '#6ee7b7', '#a7f3d0', '#10b981', '#059669'];

function App() {
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const color = COLORS[count % COLORS.length];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f0d',
      color: '#e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      gap: '1.5rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Granger Sandbox Demo
      </div>
      <h1 style={{ fontSize: '3rem', fontWeight: 700, margin: 0, color }}>
        {count}
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
        {time} — Running in Vercel Sandbox
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            background: color,
            color: '#0a0f0d',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.1s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Increment
        </button>
        <button
          onClick={() => setCount(0)}
          style={{
            background: 'transparent',
            color: '#9ca3af',
            border: '1px solid #374151',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#4b5563', textAlign: 'center', maxWidth: '400px' }}>
        This React app is running in a Vercel Sandbox microVM.
        It was created with pre-made files, npm install, and vite dev server.
      </div>
    </div>
  );
}

export default App;
`,
  },
];

/**
 * POST — Start or restart the demo sandbox
 * GET — Get status of the demo sandbox
 * DELETE — Stop the demo sandbox
 */
export async function POST() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Stop existing sandbox if any
  if (activeSandbox) {
    try {
      await activeSandbox.sandbox.stop();
    } catch { /* may already be stopped */ }
    activeSandbox = null;
  }

  try {
    // Create sandbox
    const sandbox = await Sandbox.create({
      runtime: "node24",
      ports: [5173],
      timeout: 600_000, // 10 minutes
      env: { HOST: "0.0.0.0" },
    });

    // Write all demo files
    await sandbox.writeFiles(
      DEMO_FILES.map((f) => ({ path: f.path, content: Buffer.from(f.content) })),
    );

    // Install dependencies
    const installResult = await sandbox.runCommand("npm", ["install"]);
    if (installResult.exitCode !== 0) {
      const stderr = await installResult.stderr();
      await sandbox.stop();
      return NextResponse.json({
        error: `npm install failed (exit ${installResult.exitCode})`,
        stderr: stderr.slice(0, 500),
      }, { status: 500 });
    }

    // Start dev server (detached — runs in background)
    sandbox.runCommand("npm", ["run", "dev"]);

    // Wait for server to be ready
    const previewUrl = sandbox.domain(5173);
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(previewUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Granger-Health-Check" },
        });
        if (res.status !== 502) {
          ready = true;
          break;
        }
      } catch { /* not ready */ }
    }

    activeSandbox = {
      sandbox,
      sandboxId: sandbox.name,
      previewUrl,
      status: ready ? "running" : "starting",
      createdAt: Date.now(),
    };

    return NextResponse.json({
      sandboxId: sandbox.name,
      previewUrl,
      status: ready ? "running" : "starting",
      files: DEMO_FILES.map((f) => f.path),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to create sandbox",
    }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!activeSandbox) {
    return NextResponse.json({ status: "stopped", sandboxId: null, previewUrl: null });
  }

  // Check if still alive
  try {
    const res = await fetch(activeSandbox.previewUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Granger-Health-Check" },
    });
    activeSandbox.status = res.status !== 502 ? "running" : "unhealthy";
  } catch {
    activeSandbox.status = "unhealthy";
  }

  return NextResponse.json({
    sandboxId: activeSandbox.sandboxId,
    previewUrl: activeSandbox.previewUrl,
    status: activeSandbox.status,
    uptime: Math.floor((Date.now() - activeSandbox.createdAt) / 1000),
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!activeSandbox) {
    return NextResponse.json({ status: "already_stopped" });
  }

  try {
    await activeSandbox.sandbox.stop();
  } catch { /* best effort */ }
  activeSandbox = null;

  return NextResponse.json({ status: "stopped" });
}
