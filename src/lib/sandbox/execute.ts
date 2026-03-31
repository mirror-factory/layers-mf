import { Sandbox } from "@vercel/sandbox";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  previewUrl?: string;
  sandboxId?: string;
  snapshotId?: string;
}

// Cache of active sandboxes per org for persistent sessions
const activeSandboxes = new Map<string, { sandbox: Sandbox; lastUsed: number }>();

/**
 * Get or create a persistent sandbox for an org.
 * Reuses existing sandbox if still alive, creates new one otherwise.
 */
async function getOrCreateSandbox(options: {
  orgId?: string;
  runtime?: "node24" | "python3.13";
  ports?: number[];
  timeout?: number;
  snapshotId?: string;
}): Promise<Sandbox> {
  const key = options.orgId ?? "default";
  const cached = activeSandboxes.get(key);

  // Reuse if still alive and recent (< 5 min since last use)
  if (cached && Date.now() - cached.lastUsed < 5 * 60 * 1000) {
    cached.lastUsed = Date.now();
    return cached.sandbox;
  }

  // Create new sandbox (from snapshot if available)
  const sandbox = await Sandbox.create({
    runtime: options.runtime ?? "node24",
    ports: options.ports ?? [],
    timeout: options.timeout ?? 600_000,
    // ...(options.snapshotId ? { snapshot: options.snapshotId } : {}),
  });

  activeSandboxes.set(key, { sandbox, lastUsed: Date.now() });
  return sandbox;
}

/**
 * Detect if code is HTML content that should be served, not executed.
 */
function isHtmlContent(code: string, filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'html' || ext === 'htm') return true;
  if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) return true;
  return false;
}

/**
 * Execute code in a Vercel Sandbox microVM.
 * Supports Node.js and Python runtimes.
 * Auto-detects HTML and serves it with a static server for live preview.
 */
export async function executeInSandbox(options: {
  code: string;
  language: "javascript" | "typescript" | "python" | "html";
  filename?: string;
  installPackages?: string[];
  exposePort?: number;
  timeout?: number;
}): Promise<SandboxResult> {
  const filename =
    options.filename ??
    (options.language === "python" ? "main.py" :
     options.language === "html" ? "index.html" : "index.js");

  const isHtml = options.language === "html" || isHtmlContent(options.code, filename);

  // For HTML content: serve it with a simple static server
  if (isHtml) {
    const port = options.exposePort ?? 3000;
    const sandbox = await Sandbox.create({
      runtime: "node24",
      ports: [port],
      timeout: options.timeout ?? 600_000, // 10 min — sandbox supports up to 45 min on Hobby
    });

    try {
      // Write the HTML file
      await sandbox.writeFiles([
        { path: "public/index.html", content: Buffer.from(options.code) },
      ]);

      // Create a simple static file server
      const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(${port}, () => console.log('Serving on port ${port}'));
`;
      await sandbox.writeFiles([
        { path: "server.js", content: Buffer.from(serverCode) },
      ]);

      // Start the server (don't await — it runs in background)
      sandbox.runCommand("node", ["server.js"]);

      // Wait for server to be ready (2s initial wait)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const previewUrl = sandbox.domain(port);

      // Health check: verify the preview URL responds before returning
      try {
        const check = await fetch(previewUrl, { signal: AbortSignal.timeout(5000) });
        if (!check.ok) {
          // Retry after another second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch {
        // URL not ready yet — retry once after a delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
          await fetch(previewUrl, { signal: AbortSignal.timeout(5000) });
        } catch {
          // Still not responding, return URL anyway — it may work by the time user clicks
        }
      }

      return {
        stdout: `Serving HTML at ${previewUrl}`,
        stderr: "",
        exitCode: 0,
        previewUrl,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { stdout: "", stderr: msg, exitCode: 1 };
    }
  }

  // For regular code: execute and return output
  const runtime = options.language === "python" ? "python3.13" : "node24";
  const sandbox = await Sandbox.create({
    runtime,
    ports: options.exposePort ? [options.exposePort] : [],
    timeout: options.timeout ?? 300_000, // 5 min for code execution
  });

  try {
    await sandbox.writeFiles([
      { path: filename, content: Buffer.from(options.code) },
    ]);

    if (options.installPackages?.length) {
      const installCmd = options.language === "python" ? "pip" : "npm";
      const installArgs = ["install", ...options.installPackages];
      await sandbox.runCommand(installCmd, installArgs);
    }

    const cmd = options.language === "python" ? "python3" : "node";
    const result = await sandbox.runCommand(cmd, [filename]);

    const stdout = await result.stdout();
    const stderr = await result.stderr();
    const exitCode = result.exitCode;

    const previewUrl = options.exposePort
      ? sandbox.domain(options.exposePort)
      : undefined;

    return { stdout, stderr, exitCode, previewUrl, sandboxId: sandbox.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: msg, exitCode: 1 };
  } finally {
    if (!options.exposePort) {
      await sandbox.stop();
    }
  }
}
