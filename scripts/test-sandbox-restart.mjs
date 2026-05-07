#!/usr/bin/env node
/**
 * Test script: verify sandbox restart works for an existing artifact.
 *
 * Usage: node scripts/test-sandbox-restart.mjs [artifactId]
 *
 * If no artifactId provided, finds the most recent sandbox artifact automatically.
 * Requires .env.local with SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function supabaseQuery(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Step 1: Find an artifact with sandbox data
const artifactId = process.argv[2];
let artifact;

if (artifactId) {
  const rows = await supabaseQuery("artifacts", `id=eq.${artifactId}&select=*`);
  artifact = rows[0];
} else {
  console.log("🔍 Finding most recent sandbox artifact...");
  const rows = await supabaseQuery(
    "artifacts",
    "select=id,title,preview_url,snapshot_id,run_command,expose_port,current_version,org_id,framework&status=eq.active&preview_url=not.is.null&order=updated_at.desc&limit=5"
  );
  if (rows.length === 0) {
    // Try any artifact with files
    const allRows = await supabaseQuery(
      "artifacts",
      "select=id,title,preview_url,snapshot_id,run_command,expose_port,current_version,org_id,framework&status=eq.active&order=updated_at.desc&limit=5"
    );
    artifact = allRows[0];
  } else {
    artifact = rows[0];
  }
}

if (!artifact) {
  console.error("❌ No artifacts found in database");
  process.exit(1);
}

console.log(`\n📦 Artifact: ${artifact.title ?? "Untitled"}`);
console.log(`   ID: ${artifact.id}`);
console.log(`   Framework: ${artifact.framework ?? "unknown"}`);
console.log(`   Current version: ${artifact.current_version}`);
console.log(`   Preview URL: ${artifact.preview_url ?? "none"}`);
console.log(`   Snapshot ID: ${artifact.snapshot_id ?? "none"}`);
console.log(`   Run command: ${artifact.run_command ?? "npm run dev"}`);
console.log(`   Expose port: ${artifact.expose_port ?? 5173}`);

// Step 2: Get artifact files
console.log(`\n📁 Fetching files for version ${artifact.current_version}...`);
const files = await supabaseQuery(
  "artifact_files",
  `artifact_id=eq.${artifact.id}&version_number=eq.${artifact.current_version}&select=file_path,content&order=file_path`
);

if (files.length === 0) {
  console.error("❌ No files found for this artifact version");
  console.log("   This is the bug we fixed — file_path column was queried as 'path'");
  process.exit(1);
}

console.log(`   Found ${files.length} files:`);
for (const f of files) {
  const size = f.content?.length ?? 0;
  console.log(`   - ${f.file_path} (${size} chars)`);
}

// Step 3: Test the old preview URL
if (artifact.preview_url) {
  console.log(`\n🌐 Testing old preview URL: ${artifact.preview_url}`);
  try {
    const res = await fetch(artifact.preview_url, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    const body = await res.text();
    const status = res.status;
    if (status === 410) {
      console.log(`   ⚠️  410 SANDBOX_STOPPED — sandbox expired (expected for old artifacts)`);
    } else if (status === 502) {
      console.log(`   ⚠️  502 SANDBOX_NOT_LISTENING — sandbox alive but server not running`);
    } else if (status === 200) {
      console.log(`   ✅ 200 OK — sandbox still alive! (${body.length} bytes)`);
    } else {
      console.log(`   ⚠️  ${status} — ${body.slice(0, 100)}`);
    }
  } catch (err) {
    console.log(`   ❌ Connection failed: ${err.message}`);
  }
}

// Step 4: Test sandbox creation with the deterministic name
console.log(`\n🚀 Testing sandbox restart via executeProject...`);
const sandboxName = `layers-${artifact.org_id.slice(0, 8)}-${artifact.id.slice(0, 8)}`;
console.log(`   Sandbox name: ${sandboxName}`);

try {
  // Dynamic import of the execute module (needs Next.js module resolution)
  // Instead, we'll call the Vercel Sandbox SDK directly
  const { Sandbox } = await import("@vercel/sandbox");

  // First check if sandbox already exists
  let sandbox;
  let isResumed = false;
  try {
    sandbox = await Sandbox.get({ name: sandboxName });
    isResumed = true;
    console.log(`   ♻️  Resumed existing sandbox: ${sandboxName}`);
  } catch {
    console.log(`   🆕 Sandbox not found, creating new: ${sandboxName}`);
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    sandbox = await Sandbox.create({
      name: sandboxName,
      runtime: "node24",
      ports: [artifact.expose_port ?? 5173],
      timeout: 600_000,
      env: {
        HOST: "0.0.0.0",
        ...(gatewayKey ? { AI_GATEWAY_API_KEY: gatewayKey } : {}),
        PORT: String(artifact.expose_port ?? 5173),
      },
    });
    console.log(`   ✅ Created sandbox: ${sandbox.name}`);
  }

  // Write files
  const fileBuffers = files.map(f => ({
    path: f.file_path,
    content: Buffer.from(f.content),
  }));
  await sandbox.writeFiles(fileBuffers);
  console.log(`   📝 Wrote ${fileBuffers.length} files`);

  // Install if needed
  const hasNodeModules = isResumed && (await sandbox.runCommand("test", ["-d", "node_modules"])).exitCode === 0;
  if (!hasNodeModules) {
    console.log(`   📦 Installing dependencies...`);
    const installResult = await sandbox.runCommand("npm", ["install"]);
    if (installResult.exitCode !== 0) {
      const stderr = await installResult.stderr();
      console.error(`   ❌ Install failed: ${stderr.slice(0, 200)}`);
      process.exit(1);
    }
    console.log(`   ✅ Dependencies installed`);
  } else {
    console.log(`   ⏭️  Skipping install (node_modules present)`);
  }

  // Start dev server
  const runParts = (artifact.run_command ?? "npm run dev").split(" ");
  await sandbox.runCommand({ cmd: runParts[0], args: runParts.slice(1), detached: true });
  const previewUrl = sandbox.domain(artifact.expose_port ?? 5173);
  console.log(`   🌐 Dev server started, preview: ${previewUrl}`);

  // Health check — poll until ready
  console.log(`   ⏳ Waiting for server to be ready...`);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch(previewUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Sandbox-Test" },
      });
      if (res.status !== 502) {
        console.log(`   ✅ Server ready after ${(i + 1) * 2}s — HTTP ${res.status}`);
        ready = true;
        break;
      }
      process.stdout.write(`   ...attempt ${i + 1}/30 (502)\n`);
    } catch {
      process.stdout.write(`   ...attempt ${i + 1}/30 (connection failed)\n`);
    }
  }

  if (ready) {
    console.log(`\n✅ SANDBOX RESTART TEST PASSED`);
    console.log(`   Preview URL: ${previewUrl}`);
    console.log(`   Sandbox name: ${sandboxName}`);

    // Update the artifact in DB
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?id=eq.${artifact.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        preview_url: previewUrl,
        snapshot_id: sandboxName,
      }),
    });
    if (updateRes.ok) {
      console.log(`   📝 Updated artifact preview_url + snapshot_id in DB`);
    }
  } else {
    console.error(`\n❌ SANDBOX RESTART TEST FAILED — server not ready after 60s`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n❌ Sandbox error: ${err.message}`);
  if (err.message.includes("OIDC") || err.message.includes("expired")) {
    console.log("   💡 Run: npx vercel env pull");
  }
  process.exit(1);
}
