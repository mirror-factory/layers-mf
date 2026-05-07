/**
 * run-context -- single source of truth for the current feature build's run_id.
 *
 * Every artifact the harness produces for a feature build (log records, test
 * results, cost entries, doc lookups, notify events, skill invocations) is
 * tagged with the same `run_id`. The dashboard then aggregates a single
 * "run view" at `/dev-kit/runs/[run_id]` so a stakeholder can see, for one
 * feature: what was built, what tests ran, what it cost, which models fired,
 * which docs were fetched, which skills were invoked, and whether it shipped.
 *
 * Producer: Claude Code SessionStart hook (`.claude/hooks/session-start.py`)
 * generates a UUID and writes `.ai-dev-kit/state/current-run.json` on every
 * new Claude Code session. Subsequent Claude Code tool invocations inside
 * that session inherit the same run_id.
 *
 * Consumers:
 *   - `aiCall` / `logAICall` -- tag every LLM call
 *   - `withExternalCall`     -- tag every non-LLM vendor call
 *   - `withRoute`            -- tag every HTTP route entry/exit
 *   - `notify`               -- tag every ntfy event
 *   - `record-docs-lookup.py` / `record-skill-use.py` -- tag Claude Code hook events
 *   - Playwright reporter    -- tag `test-results/*.json`
 *   - Promptfoo eval output  -- tag via env var RUN_ID
 *
 * When no run is active (e.g. a server request in production, a CI job, or
 * a shell user running scripts directly), `getRunContext()` returns
 * `{ run_id: null, feature_name: null, ... }`. Wrappers must treat missing
 * run context as non-fatal -- we don't want to break production traffic
 * because a dev-time file isn't present.
 *
 * File shape (.ai-dev-kit/state/current-run.json):
 *   {
 *     "run_id": "run_01JH9F3K...",
 *     "feature_name": "brand-studio",
 *     "branch": "feat/brand-studio",
 *     "task": "Build a design suite like Claude Design.",
 *     "started_at": "2026-04-19T10:12:00.000Z",
 *     "parent_run_id": null,
 *     "spec_path": "features/brand-studio/SPEC.md"
 *   }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const STATE_FILE_REL = '.ai-dev-kit/state/current-run.json';

export interface RunContext {
  run_id: string;
  feature_name: string | null;
  branch: string | null;
  task: string | null;
  started_at: string;
  parent_run_id: string | null;
  spec_path: string | null;
}

export interface PartialRunContext {
  run_id: string | null;
  feature_name: string | null;
  branch: string | null;
  task: string | null;
  parent_run_id: string | null;
  spec_path: string | null;
}

const EMPTY: PartialRunContext = {
  run_id: null,
  feature_name: null,
  branch: null,
  task: null,
  parent_run_id: null,
  spec_path: null,
};

function stateFilePath(cwd: string = process.cwd()): string {
  return join(cwd, STATE_FILE_REL);
}

/**
 * Return the active run context or a fully-nullable placeholder.
 *
 * Never throws. Never blocks. Synchronous on purpose so wrappers can inline
 * the lookup without making every wrapped call async.
 */
export function getRunContext(cwd?: string): PartialRunContext {
  // Allow env-var override so headless contexts (CI, playwright workers,
  // subprocess scripts) can pass RUN_ID/FEATURE_NAME through and still get
  // correlation without reading the state file.
  const envRunId = process.env.RUN_ID;
  const envFeature = process.env.FEATURE_NAME;
  if (envRunId) {
    return {
      run_id: envRunId,
      feature_name: envFeature ?? null,
      branch: process.env.RUN_BRANCH ?? null,
      task: process.env.RUN_TASK ?? null,
      parent_run_id: process.env.PARENT_RUN_ID ?? null,
      spec_path: process.env.RUN_SPEC_PATH ?? null,
    };
  }

  const path = stateFilePath(cwd);
  if (!existsSync(path)) return EMPTY;

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as RunContext;
    if (!parsed.run_id) return EMPTY;
    return {
      run_id: parsed.run_id,
      feature_name: parsed.feature_name ?? null,
      branch: parsed.branch ?? null,
      task: parsed.task ?? null,
      parent_run_id: parsed.parent_run_id ?? null,
      spec_path: parsed.spec_path ?? null,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Start a new run. Called from:
 *   - SessionStart hook (Claude Code)
 *   - `ai-dev-kit run <task>` CLI command
 *
 * Idempotent only in the sense that calling it again replaces the current
 * run. Previous run state is preserved in `runs/history/<run_id>.json`.
 */
export function startRun(args: {
  feature_name?: string;
  branch?: string;
  task?: string;
  parent_run_id?: string;
  spec_path?: string;
  cwd?: string;
}): RunContext {
  const runId = generateRunId();
  const ctx: RunContext = {
    run_id: runId,
    feature_name: args.feature_name ?? null,
    branch: args.branch ?? null,
    task: args.task ?? null,
    started_at: new Date().toISOString(),
    parent_run_id: args.parent_run_id ?? null,
    spec_path: args.spec_path ?? null,
  };

  const cwd = args.cwd ?? process.cwd();
  const filePath = stateFilePath(cwd);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(ctx, null, 2));

  // History mirror so ended runs are still inspectable from the dashboard.
  const historyDir = join(cwd, '.ai-dev-kit', 'state', 'runs', 'history');
  mkdirSync(historyDir, { recursive: true });
  writeFileSync(join(historyDir, `${runId}.json`), JSON.stringify(ctx, null, 2));

  return ctx;
}

/**
 * Mark a run finished. Records the exit state (passed / blocked / max_iters /
 * user_aborted) and the final cost/test counts so the dashboard can render
 * a summary card without rescanning every log file.
 */
export function endRun(args: {
  run_id: string;
  status: 'passed' | 'blocked' | 'max_iterations' | 'user_aborted' | 'failed';
  reason?: string;
  totals?: {
    ai_calls?: number;
    vendor_calls?: number;
    cost_usd?: number;
    tests_run?: number;
    tests_passed?: number;
    iterations?: number;
  };
  cwd?: string;
}): void {
  const cwd = args.cwd ?? process.cwd();
  const historyPath = join(cwd, '.ai-dev-kit', 'state', 'runs', 'history', `${args.run_id}.json`);
  if (!existsSync(historyPath)) return;

  try {
    const raw = readFileSync(historyPath, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.ended_at = new Date().toISOString();
    parsed.status = args.status;
    parsed.reason = args.reason ?? null;
    parsed.totals = args.totals ?? null;
    writeFileSync(historyPath, JSON.stringify(parsed, null, 2));
  } catch {
    // Fall through silently. The dashboard can still render from append-only logs.
  }

  // Clear the "current" pointer so the next session doesn't inherit a stale
  // run. The history entry remains for inspection.
  const currentPath = stateFilePath(cwd);
  if (existsSync(currentPath)) {
    try {
      const raw = readFileSync(currentPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.run_id === args.run_id) {
        writeFileSync(currentPath, JSON.stringify({ ...parsed, ended_at: new Date().toISOString(), status: args.status }, null, 2));
      }
    } catch {
      // Ignore; dashboard tolerates missing/partial state.
    }
  }
}

/**
 * Generate a sortable run ID. Format: `run_<ulid-like>` where the prefix is
 * fixed and the suffix is a Crockford-base32 timestamp + random suffix.
 * ULIDs sort naturally by time, which makes /dev-kit/runs listing trivial.
 */
export function generateRunId(): string {
  const ts = Date.now();
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let tsPart = '';
  let v = ts;
  for (let i = 0; i < 10; i++) {
    tsPart = CROCKFORD[v % 32] + tsPart;
    v = Math.floor(v / 32);
  }
  let randPart = '';
  for (let i = 0; i < 16; i++) {
    randPart += CROCKFORD[Math.floor(Math.random() * 32)];
  }
  return `run_${tsPart}${randPart}`;
}

/**
 * Flatten a PartialRunContext into key/value metadata suitable for attaching
 * to log records, Langfuse spans, and OpenTelemetry attributes.
 */
export function runContextToMetadata(ctx: PartialRunContext): Record<string, string> {
  const md: Record<string, string> = {};
  if (ctx.run_id) md.run_id = ctx.run_id;
  if (ctx.feature_name) md.feature_name = ctx.feature_name;
  if (ctx.parent_run_id) md.parent_run_id = ctx.parent_run_id;
  if (ctx.branch) md.branch = ctx.branch;
  return md;
}
