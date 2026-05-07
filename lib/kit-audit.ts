/**
 * kit-audit -- append-only JSONL event log at .ai-dev-kit/state/kit-audit.jsonl.
 *
 * Purpose: when a user hits a silent failure mode in the kit, they can send us
 * `ai-dev-kit audit export` and we get ground truth of every kit-level event
 * that fired: which CLI command ran, which husky-hook step fired + outcome,
 * which Claude hook fired, which dashboard API call succeeded/failed.
 *
 * Contract:
 *   - Append-only JSONL (one JSON object per line, no bracket wrapping).
 *   - Never throws. A crashing logger is worse than no logger.
 *   - Rotates once at 10 MB -> kit-audit.jsonl.1 (last rotation kept only).
 *   - All paths resolved via process.cwd() so tests + projects behave the same.
 *
 * Correlates with the application-level run_id backbone: reads
 * .ai-dev-kit/state/current-run.json once per event so every kit event can be
 * joined onto /dev-kit/runs/[run_id] downstream.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KitAuditEvent {
  /** ISO 8601 timestamp, ms precision. */
  ts: string;
  /** Application-level run_id if minted, else null. */
  run_id: string | null;
  kind:
    | 'cli_command'
    | 'husky_hook'
    | 'claude_hook'
    | 'dashboard_api'
    | 'doctor_check'
    | 'git_state'
    | 'bootstrap_step';
  /** e.g. 'init', 'pre-commit', 'session-start-run', '/api/dev-kit/registries'. */
  name: string;
  phase?: 'start' | 'step' | 'end';
  /** Sub-step identifier for multi-step hooks. */
  step?: string;
  outcome?: 'ok' | 'fail' | 'warn' | 'skip' | 'empty';
  duration_ms?: number;
  /** First line of the error, truncated to 500 chars. */
  error?: string;
  /** Human-readable explanation ("no YAML files at path X"). */
  reason?: string;
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Paths + constants
// ---------------------------------------------------------------------------

const STATE_DIR_REL = ['.ai-dev-kit', 'state'];
const LOG_FILE = 'kit-audit.jsonl';
const ROTATED_FILE = 'kit-audit.jsonl.1';
const CURRENT_RUN_FILE = 'current-run.json';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ERROR_MAX_LEN = 500;

function stateDir(): string {
  return join(process.cwd(), ...STATE_DIR_REL);
}

function logPath(): string {
  return join(stateDir(), LOG_FILE);
}

function rotatedPath(): string {
  return join(stateDir(), ROTATED_FILE);
}

// ---------------------------------------------------------------------------
// Internal helpers (all guarded)
// ---------------------------------------------------------------------------

let _warnedOnce = false;
function swallow(prefix: string, err: unknown): void {
  // Warn only once per process so we don't flood stderr on repeated failures.
  if (_warnedOnce) return;
  _warnedOnce = true;
  try {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  [kit-audit] ${prefix}: ${msg} (further errors suppressed)\n`);
  } catch {
    /* even stderr might fail in some sandboxes; give up silently */
  }
}

function readRunId(): string | null {
  try {
    const p = join(stateDir(), CURRENT_RUN_FILE);
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { run_id?: unknown };
    return typeof parsed.run_id === 'string' ? parsed.run_id : null;
  } catch {
    return null;
  }
}

function truncateError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? '');
  const firstLine = raw.split(/\r?\n/)[0] ?? '';
  return firstLine.length > ERROR_MAX_LEN ? firstLine.slice(0, ERROR_MAX_LEN) : firstLine;
}

function rotateIfNeeded(): void {
  try {
    const p = logPath();
    if (!existsSync(p)) return;
    const size = statSync(p).size;
    if (size <= MAX_SIZE_BYTES) return;
    const rot = rotatedPath();
    if (existsSync(rot)) {
      try { unlinkSync(rot); } catch { /* best effort */ }
    }
    renameSync(p, rot);
  } catch (err) {
    swallow('rotate failed', err);
  }
}

// ---------------------------------------------------------------------------
// Public: logKitEvent
// ---------------------------------------------------------------------------

export function logKitEvent(
  event: Partial<KitAuditEvent> & { kind: KitAuditEvent['kind']; name: string },
): void {
  try {
    mkdirSync(stateDir(), { recursive: true });
    rotateIfNeeded();

    const record: KitAuditEvent = {
      ts: new Date().toISOString(),
      run_id: event.run_id ?? readRunId(),
      kind: event.kind,
      name: event.name,
    };
    if (event.phase !== undefined) record.phase = event.phase;
    if (event.step !== undefined) record.step = event.step;
    if (event.outcome !== undefined) record.outcome = event.outcome;
    if (typeof event.duration_ms === 'number' && isFinite(event.duration_ms)) {
      record.duration_ms = Math.max(0, Math.round(event.duration_ms));
    }
    if (event.error !== undefined) record.error = truncateError(event.error);
    if (event.reason !== undefined) record.reason = String(event.reason);
    if (event.meta && typeof event.meta === 'object') record.meta = event.meta;

    appendFileSync(logPath(), JSON.stringify(record) + '\n', 'utf-8');
  } catch (err) {
    swallow('append failed', err);
  }
}

// ---------------------------------------------------------------------------
// Public: readKitEvents
// ---------------------------------------------------------------------------

export function readKitEvents(opts: { last?: number; kind?: KitAuditEvent['kind'] } = {}): KitAuditEvent[] {
  const out: KitAuditEvent[] = [];
  const files = [rotatedPath(), logPath()]; // older first, then current
  for (const f of files) {
    try {
      if (!existsSync(f)) continue;
      const raw = readFileSync(f, 'utf-8');
      for (const line of raw.split(/\r?\n/)) {
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as KitAuditEvent;
          if (opts.kind && parsed.kind !== opts.kind) continue;
          out.push(parsed);
        } catch {
          /* skip malformed line */
        }
      }
    } catch (err) {
      swallow('read failed', err);
    }
  }
  if (typeof opts.last === 'number' && opts.last > 0 && out.length > opts.last) {
    return out.slice(out.length - opts.last);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: clearKitEvents
// ---------------------------------------------------------------------------

export function clearKitEvents(): void {
  for (const f of [logPath(), rotatedPath()]) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch (err) {
      swallow('clear failed', err);
    }
  }
  // Leave the state dir in place; other state files live there.
}

// ---------------------------------------------------------------------------
// Dev/test affordance: deterministic truncated-file stub write (NOT exported
// from the barrel; used only by internal tests if any). Kept here so the file
// is self-contained.
// ---------------------------------------------------------------------------

/** @internal */
export function _resetWarnOnce(): void {
  _warnedOnce = false;
}

/** @internal */
export function _writeRawForTest(content: string): void {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(logPath(), content, 'utf-8');
  } catch {
    /* ignore */
  }
}
