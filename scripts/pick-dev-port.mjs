#!/usr/bin/env node
/**
 * Picks a deterministic dev-server port in the range 4000-4099.
 *
 * Used by the Symphony per-ticket workspace lifecycle to avoid port collisions
 * when multiple agent workers boot the same app concurrently from sibling
 * worktrees. Each ticket gets a stable port derived from its identifier.
 *
 * Seed precedence:
 *   1. TICKET_HASH env (set by Symphony's after_create hook)
 *   2. WORKSPACE_ID env
 *   3. Current git branch name (fallback for human dev)
 *
 * Usage:
 *   PORT=$(node scripts/pick-dev-port.mjs) next dev -p $PORT
 *   TICKET_HASH=LAY-123 node scripts/pick-dev-port.mjs   # → e.g. 4042
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

function fallbackToBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "default";
  }
}

const seed =
  process.env.TICKET_HASH ?? process.env.WORKSPACE_ID ?? fallbackToBranch();

const hash = createHash("sha256").update(seed).digest("hex");
const port = 4000 + (parseInt(hash.slice(0, 8), 16) % 100);
process.stdout.write(String(port));
