import { Sandbox } from "@vercel/sandbox";
import { createAdminClient } from "@/lib/supabase/server";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  previewUrl?: string;
  sandboxId?: string;  // sandbox name (persistent) or ID (ephemeral)
  snapshotId?: string;
  healthCheckPassed?: boolean;
}

// ─── Cost constants ──────────────────────────────────────────────────
// ~$0.13/vCPU-hour, ~$0.085/GB-hour memory, $0.09/GB egress, $0.60/M creates
const COST_PER_CPU_MS = 0.13 / 3_600_000;
const COST_PER_MB_SECOND = 0.085 / (1024 * 3600);
const COST_PER_EGRESS_BYTE = 0.09 / (1024 * 1024 * 1024);
const COST_PER_CREATE = 0.6 / 1_000_000;

/** Compute USD cost from sandbox resource usage metrics. */
function computeSandboxCost(cpuMs: number, memoryMbSec: number, egressBytes: number): number {
  return (
    cpuMs * COST_PER_CPU_MS +
    memoryMbSec * COST_PER_MB_SECOND +
    egressBytes * COST_PER_EGRESS_BYTE +
    COST_PER_CREATE // one create per execution
  );
}

/** Record a sandbox execution's usage and cost in the sandbox_usage table. */
async function recordSandboxUsage(opts: {
  orgId: string;
  userId?: string;
  sandboxId?: string;
  cpuMs: number;
  memoryMbSeconds: number;
  networkIngressBytes: number;
  networkEgressBytes: number;
}): Promise<void> {
  const costUsd = computeSandboxCost(
    opts.cpuMs,
    opts.memoryMbSeconds,
    opts.networkEgressBytes,
  );

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("sandbox_usage")
    .insert({
      org_id: opts.orgId,
      user_id: opts.userId ?? null,
      sandbox_id: opts.sandboxId ?? null,
      cpu_ms: opts.cpuMs,
      memory_mb_seconds: opts.memoryMbSeconds,
      network_ingress_bytes: opts.networkIngressBytes,
      network_egress_bytes: opts.networkEgressBytes,
      cost_usd: costUsd,
    });

  console.log(
    `[sandbox-usage] org=${opts.orgId} cost=$${costUsd.toFixed(6)} cpu=${opts.cpuMs}ms egress=${opts.networkEgressBytes}B`,
  );
}

// Cache of active sandboxes per org for persistent sessions
const activeSandboxes = new Map<string, { sandbox: Sandbox; lastUsed: number }>();

/**
 * Get the latest snapshot for an org from supabase.
 * Returns the Vercel snapshot ID if one exists, null otherwise.
 */
export async function getLatestSnapshot(orgId: string): Promise<{
  snapshotId: string;
  name: string;
  metadata: Record<string, unknown>;
} | null> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sandbox_snapshots")
    .select("snapshot_id, name, metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    snapshotId: data.snapshot_id,
    name: data.name,
    metadata: data.metadata ?? {},
  };
}

/**
 * Save a sandbox snapshot to the database after execution.
 */
async function saveSnapshot(
  orgId: string,
  snapshotId: string,
  name: string,
  metadata: Record<string, unknown>,
  cpuUsageMs: number,
  networkIngressBytes: number,
  networkEgressBytes: number,
): Promise<void> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("sandbox_snapshots")
    .insert({
      org_id: orgId,
      snapshot_id: snapshotId,
      name,
      metadata,
      cpu_usage_ms: cpuUsageMs,
      network_ingress_bytes: networkIngressBytes,
      network_egress_bytes: networkEgressBytes,
    });
}

/** Helper to build Sandbox.create params, restoring from snapshot when available. */
function createParams(options: {
  runtime?: string;
  ports?: number[];
  timeout?: number;
  snapshotId?: string;
  env?: Record<string, string>;
}) {
  // Inject AI Gateway key so sandbox apps can call AI models
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const env = {
    HOST: "0.0.0.0",
    ...(gatewayKey ? { AI_GATEWAY_API_KEY: gatewayKey } : {}),
    ...options.env,
  };
  if (options.snapshotId) {
    return {
      source: { type: "snapshot" as const, snapshotId: options.snapshotId },
      ports: options.ports ?? [],
      timeout: options.timeout ?? 600_000,
      env,
    };
  }
  return {
    runtime: options.runtime ?? "node24",
    ports: options.ports ?? [],
    timeout: options.timeout ?? 600_000,
    env,
  };
}

/**
 * Get or create a persistent sandbox for an org.
 * Reuses existing sandbox if still alive, creates new one otherwise.
 * Restores from snapshot when available for instant start.
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

  // Remove stale entry
  if (cached) activeSandboxes.delete(key);

  // Check OIDC token validity before attempting sandbox creation (local dev only)
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (oidcToken && !process.env.VERCEL) {
    try {
      const payload = JSON.parse(Buffer.from(oidcToken.split(".")[1], "base64url").toString());
      if (payload.exp && Date.now() > payload.exp * 1000) {
        throw new Error(
          "Vercel OIDC token expired. Run `npx vercel env pull` to refresh it, then restart the dev server."
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("expired")) throw e;
      // Malformed token — let Sandbox.create handle the auth error
    }
  }

  // Retry up to 3 times on create failure
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sandbox = await Sandbox.create(createParams(options));
      activeSandboxes.set(key, { sandbox, lastUsed: Date.now() });
      return sandbox;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[sandbox] Create attempt ${attempt + 1}/3 failed: ${lastError.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastError ?? new Error("Failed to create sandbox after 3 attempts");
}

/**
 * Take a snapshot of a sandbox, log usage metrics, and persist to DB.
 * Note: sandbox.snapshot() stops the sandbox as part of the process.
 * Returns the snapshot ID if successful.
 */
async function snapshotAndPersist(
  sandbox: Sandbox,
  orgId: string,
  name: string,
  metadata: Record<string, unknown>,
  userId?: string,
): Promise<string | undefined> {
  try {
    // snapshot() stops the sandbox and returns a Snapshot object
    const snapshot = await sandbox.snapshot();
    const sid = snapshot.snapshotId;

    // After snapshot (which stops the VM), usage metrics become available
    const cpuUsageMs = sandbox.activeCpuUsageMs ?? 0;
    const networkIngress = sandbox.networkTransfer?.ingress ?? 0;
    const networkEgress = sandbox.networkTransfer?.egress ?? 0;

    console.log(
      `[sandbox] org=${orgId} cpu=${cpuUsageMs}ms ingress=${networkIngress}B egress=${networkEgress}B snapshot=${sid}`,
    );

    await saveSnapshot(orgId, sid, name, metadata, cpuUsageMs, networkIngress, networkEgress);

    // Record cost in sandbox_usage table
    await recordSandboxUsage({
      orgId,
      userId,
      sandboxId: sandbox.name,
      cpuMs: cpuUsageMs,
      memoryMbSeconds: 0, // memory not yet exposed by Vercel SDK
      networkIngressBytes: networkIngress,
      networkEgressBytes: networkEgress,
    });

    return sid;
  } catch (err) {
    console.error("[sandbox] snapshot failed:", err instanceof Error ? err.message : err);
    // Best-effort stop if snapshot itself failed
    try { await sandbox.stop(); } catch { /* best effort */ }
    return undefined;
  }
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
 * Poll a URL until it returns a non-502 response with a non-empty body.
 * Returns true if the URL became reachable, false if it timed out.
 */
async function waitForServer(
  url: string,
  options: { initialDelayMs?: number; pollIntervalMs?: number; maxAttempts?: number; timeoutPerRequestMs?: number } = {},
): Promise<boolean> {
  const {
    initialDelayMs = 3000,
    pollIntervalMs = 2000,
    maxAttempts = 40,
    timeoutPerRequestMs = 5000,
  } = options;

  // Initial wait for the process to start
  await new Promise(resolve => setTimeout(resolve, initialDelayMs));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutPerRequestMs),
        headers: { "User-Agent": "Granger-Health-Check" },
      });

      // 502 means the proxy is up but the upstream server is not ready yet
      if (res.status === 502) {
        console.log(`[sandbox-health] Attempt ${attempt + 1}/${maxAttempts}: 502 Bad Gateway — server starting`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      // Any non-502 response means the server is up (Vite returns 200 with empty body initially)
      console.log(`[sandbox-health] Ready after ${attempt + 1} attempts, HTTP ${res.status}`);
      return true;
    } catch {
      // Connection refused, timeout, etc. — server not ready yet
      if (attempt % 5 === 0) {
        console.log(`[sandbox-health] Attempt ${attempt + 1}/${maxAttempts}: connection failed — retrying`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.warn(`[sandbox-health] URL ${url} not ready after ${maxAttempts} attempts`);
  return false;
}

/**
 * Patch a Vite config string to ensure allowedHosts: true and host: '0.0.0.0'.
 * Handles multiple config formats: defineConfig(), object export, etc.
 */
function patchViteConfig(content: string): string {
  let patched = content;

  // Replace existing allowedHosts values (string, array, or false)
  patched = patched.replace(/allowedHosts:\s*(?:['"][^'"]*['"]|\[[^\]]*\]|false|true)/g, "allowedHosts: true");

  if (!patched.includes("allowedHosts")) {
    // Try to inject into existing server block
    if (patched.match(/server\s*:\s*\{/)) {
      patched = patched.replace(/server\s*:\s*\{/, "server: { allowedHosts: true,");
    }
    // If no server block, inject one into defineConfig or the export object
    else if (patched.includes("defineConfig")) {
      patched = patched.replace(
        /defineConfig\s*\(\s*\{/,
        "defineConfig({ server: { host: '0.0.0.0', allowedHosts: true },",
      );
    }
    // Plain object export: export default { ... }
    else if (patched.match(/export\s+default\s+\{/)) {
      patched = patched.replace(
        /export\s+default\s+\{/,
        "export default { server: { host: '0.0.0.0', allowedHosts: true },",
      );
    }
  }

  // Ensure host is set to 0.0.0.0 for sandbox accessibility
  if (!patched.includes("host:") && patched.match(/server\s*:\s*\{/)) {
    patched = patched.replace(/server\s*:\s*\{/, "server: { host: '0.0.0.0',");
  }

  return patched;
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
  orgId?: string;
  userId?: string;
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

      const previewUrl = sandbox.domain(port);

      // Poll until the static server is actually serving content
      const ready = await waitForServer(previewUrl, {
        initialDelayMs: 1500,
        pollIntervalMs: 1000,
        maxAttempts: 15,
        timeoutPerRequestMs: 3000,
      });

      return {
        stdout: ready
          ? `Serving HTML at ${previewUrl}`
          : `Server started but health check timed out. Preview may still load: ${previewUrl}`,
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

    // Auto-detect Python imports and install missing packages
    let packagesToInstall = options.installPackages ?? [];
    if (options.language === "python" && packagesToInstall.length === 0) {
      const importRegex = /^\s*(?:import|from)\s+(\w+)/gm;
      const stdlibModules = new Set([
        "os", "sys", "json", "re", "math", "datetime", "time", "random",
        "collections", "itertools", "functools", "pathlib", "io", "csv",
        "string", "typing", "abc", "copy", "hashlib", "base64", "urllib",
        "http", "socket", "threading", "subprocess", "shutil", "glob",
        "argparse", "logging", "unittest", "dataclasses", "enum", "decimal",
        "fractions", "statistics", "secrets", "uuid", "pprint", "textwrap",
        "struct", "array", "queue", "heapq", "bisect", "contextlib",
      ]);
      const detectedPackages = new Set<string>();
      let match;
      while ((match = importRegex.exec(options.code)) !== null) {
        const pkg = match[1];
        if (!stdlibModules.has(pkg)) {
          // Map common import names to pip package names
          const pipName = pkg === "cv2" ? "opencv-python"
            : pkg === "sklearn" ? "scikit-learn"
            : pkg === "PIL" ? "Pillow"
            : pkg === "bs4" ? "beautifulsoup4"
            : pkg === "yaml" ? "pyyaml"
            : pkg;
          detectedPackages.add(pipName);
        }
      }
      if (detectedPackages.size > 0) {
        packagesToInstall = [...detectedPackages];
      }
    }

    if (packagesToInstall.length > 0) {
      const installCmd = options.language === "python" ? "pip" : "npm";
      const installArgs = ["install", ...packagesToInstall];
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

    return { stdout, stderr, exitCode, previewUrl, sandboxId: sandbox.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: msg, exitCode: 1 };
  } finally {
    if (!options.exposePort) {
      // Record usage before stopping (metrics available after stop)
      await sandbox.stop();

      if (options.orgId) {
        const cpuMs = sandbox.activeCpuUsageMs ?? 0;
        const ingress = sandbox.networkTransfer?.ingress ?? 0;
        const egress = sandbox.networkTransfer?.egress ?? 0;

        await recordSandboxUsage({
          orgId: options.orgId,
          userId: options.userId,
          sandboxId: sandbox.name,
          cpuMs,
          memoryMbSeconds: 0,
          networkIngressBytes: ingress,
          networkEgressBytes: egress,
        }).catch((err) => {
          console.error("[sandbox-usage] record failed:", err instanceof Error ? err.message : err);
        });
      }
    }
  }
}

/**
 * Execute a multi-file project in a Vercel Sandbox.
 * Supports: writing multiple files, installing packages, running commands,
 * exposing ports for live preview, reading output files, and snapshot persistence.
 */
export async function executeProject(options: {
  files: { path: string; content: string }[];
  installCommand?: string;
  runCommand: string;
  readOutputFiles?: string[];
  exposePort?: number;
  runtime?: "node24" | "python3.13";
  timeout?: number;
  orgId?: string;
  userId?: string;
  snapshotId?: string;
  sandboxName?: string;
}): Promise<SandboxResult & { outputFiles?: { path: string; content: string }[] }> {
  // Use persistent sandboxes — one per artifact, auto-save/resume
  // If sandboxName is provided, use that; otherwise generate from orgId
  const sandboxName = options.sandboxName ?? (options.orgId ? `layers-${options.orgId.slice(0, 8)}-${Date.now().toString(36)}` : undefined);
  console.log(`[sandbox] name=${sandboxName ?? "ephemeral"}, port=${options.exposePort ?? "none"}`);

  // Try to resume existing persistent sandbox, or create new one
  let sandbox: Sandbox;
  let isResumed = false;

  if (sandboxName) {
    try {
      sandbox = await Sandbox.get({ name: sandboxName });
      isResumed = true;
      console.log(`[sandbox] Resumed persistent sandbox: ${sandboxName}`);
    } catch {
      // Doesn't exist yet — create it
      const gatewayKey = process.env.AI_GATEWAY_API_KEY;
      sandbox = await Sandbox.create({
        name: sandboxName,
        runtime: (options.runtime ?? "node24") as "node24" | "node22" | "python3.13",
        ports: options.exposePort ? [options.exposePort] : [],
        timeout: options.timeout ?? 600_000,
        snapshotExpiration: 0, // never expire snapshots
        env: {
          HOST: "0.0.0.0",
          ...(gatewayKey ? { AI_GATEWAY_API_KEY: gatewayKey } : {}),
          ...(options.exposePort ? { PORT: String(options.exposePort) } : {}),
        },
      });
      console.log(`[sandbox] Created persistent sandbox: ${sandboxName}`);
    }
  } else {
    // Ephemeral fallback (no orgId)
    sandbox = await Sandbox.create(createParams({
      runtime: options.runtime ?? "node24",
      ports: options.exposePort ? [options.exposePort] : [],
      timeout: options.timeout ?? 600_000,
    }));
  }

  try {
    // Patch Vite configs for sandbox compatibility
    const patchedFiles = options.files.map(f => {
      if (f.path.endsWith("vite.config.js") || f.path.endsWith("vite.config.ts")) {
        return { ...f, content: patchViteConfig(f.content) };
      }
      return f;
    });

    // Write all project files
    await sandbox.writeFiles(
      patchedFiles.map(f => ({ path: f.path, content: Buffer.from(f.content) }))
    );
    console.log(`[sandbox] Wrote ${patchedFiles.length} files`);

    // Install dependencies — skip if resumed AND node_modules exists
    const hasNodeModules = isResumed && (await sandbox.runCommand('test', ['-d', 'node_modules'])).exitCode === 0;
    if (options.installCommand && !hasNodeModules) {
      console.log(`[sandbox] Installing: ${options.installCommand}`);
      const installParts = options.installCommand.split(" ");
      const installResult = await sandbox.runCommand(installParts[0], installParts.slice(1));
      if (installResult.exitCode !== 0) {
        const installStderr = await installResult.stderr();
        return {
          stdout: "",
          stderr: `Install failed: ${installStderr}`,
          exitCode: installResult.exitCode,
          sandboxId: sandboxName ?? sandbox.name,
        };
      }
      console.log("[sandbox] Install complete");
    } else if (hasNodeModules) {
      console.log("[sandbox] Skipping install (persistent sandbox — node_modules present)");
    }

    return executeFromSandbox(sandbox, options, sandboxName);
  } catch (err) {
    // Don't stop persistent sandboxes on error — they auto-save
    if (!sandboxName) {
      try { await sandbox.stop(); } catch { /* ignore */ }
    }
    throw err;
  }
}

/** Run the dev server / command on an already-prepared sandbox */
async function executeFromSandbox(
  sandbox: Sandbox,
  options: {
    runCommand: string;
    readOutputFiles?: string[];
    exposePort?: number;
    orgId?: string;
    userId?: string;
  },
  snapshotId: string | undefined,
): Promise<SandboxResult & { outputFiles?: { path: string; content: string }[] }> {
  const parts = options.runCommand.split(" ");

  if (options.exposePort) {
    // Run dev server detached — returns immediately, server boots in background
    await sandbox.runCommand({ cmd: parts[0], args: parts.slice(1), detached: true });
    const previewUrl = sandbox.domain(options.exposePort);
    console.log(`[sandbox] Dev server started (detached), preview: ${previewUrl}`);

    // Quick health check — wait up to 10s for Vite to compile, then return
    // This prevents the iframe from loading too early and showing blank
    const ready = await waitForServer(previewUrl, {
      initialDelayMs: 1500,
      pollIntervalMs: 1000,
      maxAttempts: 8,
      timeoutPerRequestMs: 3000,
    });
    console.log(`[sandbox] Health check: ${ready ? "READY" : "still starting (iframe will retry)"}`);

    return {
      stdout: `Project running at ${previewUrl}`,
      stderr: "",
      exitCode: 0,
      previewUrl,
      sandboxId: sandbox.name,
      snapshotId,
      healthCheckPassed: ready,
    };
  }

  // Otherwise run and capture output
  const result = await sandbox.runCommand(parts[0], parts.slice(1));
  const stdout = await result.stdout();
  const stderr = await result.stderr();

  // Read output files if requested
  let outputFiles: { path: string; content: string }[] | undefined;
  if (options.readOutputFiles?.length) {
    outputFiles = [];
    for (const filePath of options.readOutputFiles) {
      try {
        const stream = await sandbox.readFile({ path: filePath });
        if (stream) {
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          outputFiles.push({ path: filePath, content: Buffer.concat(chunks).toString() });
        }
      } catch {
        // File may not exist — skip
      }
    }
  }

  return {
    stdout,
    stderr,
    exitCode: result.exitCode,
    sandboxId: sandbox.name,
    snapshotId,
    outputFiles,
  };
}
