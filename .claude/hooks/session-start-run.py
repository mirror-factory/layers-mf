#!/usr/bin/env python3
"""
session-start-run -- generate a run_id for every Claude Code session.

Runs at SessionStart. Writes `.ai-dev-kit/state/current-run.json` with:
  - run_id (ULID-like, sortable)
  - branch (from git)
  - feature_name (parsed from branch: feat/<name>, fix/<name>, etc.)
  - started_at (ISO8601)
  - spec_path (features/<name>/SPEC.md if present)

Every subsequent log record, test run, vendor call, eval run, and notify
event in this session inherits the same run_id. The dashboard at
/dev-kit/runs/[run_id] aggregates everything by that key.

Idempotent: if a run is already active AND the branch matches, we keep the
existing run_id. This means a user can reopen a Claude Code session mid-
feature and resume the same run. If the branch changed, we start a new
run (previous one moves to history automatically via its ended_at timestamp
from the next endRun call).

Silent on any error. A broken session-start hook must not block Claude Code.
"""
import json
import os
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


STATE_DIR = Path(".ai-dev-kit/state")
CURRENT_FILE = STATE_DIR / "current-run.json"
HISTORY_DIR = STATE_DIR / "runs" / "history"

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

# 0.2.17: kit-audit log fan-out. Importable from sibling record-kit-event.py
# so each Claude hook invocation is recorded in .ai-dev-kit/state/kit-audit.jsonl.
# Never raises -- audit failures can't block the hook.
sys.path.insert(0, str(Path(__file__).parent))
try:
    from record_kit_event import log_kit_event  # type: ignore
except Exception:
    def log_kit_event(*_a, **_kw):  # type: ignore
        pass


def generate_run_id() -> str:
    """ULID-ish run id. Sortable by time."""
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    ts_part = ""
    v = ts
    for _ in range(10):
        ts_part = CROCKFORD[v % 32] + ts_part
        v //= 32
    rand_part = "".join(random.choice(CROCKFORD) for _ in range(16))
    return f"run_{ts_part}{rand_part}"


def git_branch() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=3,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return None


def feature_name_from_branch(branch: str | None) -> str | None:
    if not branch:
        return None
    # Parse feat/brand-studio, fix/husky-compliance, claude/<slug>, etc.
    for prefix in ("feat/", "feature/", "fix/", "hotfix/", "chore/", "claude/"):
        if branch.startswith(prefix):
            return branch[len(prefix):]
    return branch


def resolve_spec_path(feature: str | None) -> str | None:
    if not feature:
        return None
    candidate = Path("features") / feature / "SPEC.md"
    return str(candidate) if candidate.exists() else None


def load_current() -> dict | None:
    if not CURRENT_FILE.exists():
        return None
    try:
        return json.loads(CURRENT_FILE.read_text())
    except Exception:
        return None


def tracking_status() -> str:
    """Snapshot of which telemetry backends are wired up, inferred from env.

    The hook can't actually `ping` Supabase/Langfuse at SessionStart (that
    would block Claude Code for seconds), so we infer from presence of the
    required env vars. The real liveness check lives in
    /api/observability/health and doctor.
    """
    supabase = "up" if (os.environ.get("SUPABASE_URL") and (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    )) else "down"
    langfuse = "up" if (
        os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY")
    ) else "down"
    return f"Supabase={supabase}, Langfuse={langfuse}"


def emit_envelope(additional_context: str) -> None:
    """Claude Code reads SessionStart hook output as a JSON envelope on
    stdout. Plain prints get filtered and never make it into the agent
    context, which is why the 0.2.16 audit found users couldn't tell
    whether the session hook ran. Always emit this envelope so the
    additionalContext message is injected verbatim.
    """
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": additional_context,
        }
    }))


def check_brand_tokens() -> str | None:
    """Gap 11: Warn if design-tokens.yaml exists but has <= 4 color entries."""
    tokens_path = Path('.ai-dev-kit/registries/design-tokens.yaml')
    if not tokens_path.exists():
        return None
    try:
        text = tokens_path.read_text()
        # Minimal YAML parse: count top-level color entries under `colors:`.
        in_colors = False
        color_count = 0
        for line in text.split('\n'):
            stripped = line.strip()
            if stripped.startswith('colors:'):
                in_colors = True
                continue
            if in_colors:
                # A new top-level key ends the colors block.
                if line and not line[0].isspace() and not line.startswith('#'):
                    break
                # Count indented key: value pairs (not comments, not list items).
                if stripped and not stripped.startswith('#') and ':' in stripped:
                    color_count += 1
        if color_count <= 4:
            return (
                "WARNING: design-tokens.yaml has only {n} color entries (likely template defaults). "
                "Configure real brand tokens (colors, typography, design direction) before generating UI."
            ).format(n=color_count)
    except Exception:
        pass
    return None


def check_agents_md_freshness() -> str | None:
    """Gap 15: Warn if AGENTS.md is older than 24 hours."""
    agents_path = Path('AGENTS.md')
    if not agents_path.exists():
        return None
    try:
        mtime = agents_path.stat().st_mtime
        age_hours = (datetime.now(timezone.utc).timestamp() - mtime) / 3600
        if age_hours > 24:
            return (
                "WARNING: AGENTS.md is {h:.0f}h old (>24h). "
                "Run `npx ai-dev-kit onboard` to refresh the Kit Catalog."
            ).format(h=age_hours)
    except Exception:
        pass
    return None


def main() -> int:
    try:
        # stdin carries Claude Code's SessionStart event JSON; we don't
        # strictly need it but we read it to stay compatible with the hook
        # contract (future: use session_id from payload as parent_run_id for
        # sub-agent spawning).
        try:
            sys.stdin.read()
        except Exception:
            pass

        branch = git_branch()
        feature = feature_name_from_branch(branch)
        spec = resolve_spec_path(feature)

        tracking = tracking_status()

        # Gap 11: Brand spec check.
        brand_warn = check_brand_tokens()
        # Gap 15: AGENTS.md freshness check.
        agents_warn = check_agents_md_freshness()

        # Resume behavior: if there's already a current run on the same branch
        # and it hasn't ended, keep it. Prevents a run_id per reopen.
        current = load_current()
        if current and current.get("branch") == branch and not current.get("ended_at"):
            existing_id = current.get("run_id", "unknown")
            extra_warnings = ""
            if brand_warn:
                extra_warnings += f" | {brand_warn}"
            if agents_warn:
                extra_warnings += f" | {agents_warn}"
            emit_envelope(
                f"Run ID: {existing_id} (resumed) | branch: {branch or 'unknown'} | "
                f"feature: {feature or 'none'} | Tracking: {tracking} | "
                f"dashboard: /dev-kit/runs/{existing_id}{extra_warnings}"
            )
            return 0

        # Graceful fallback: if we can't create the state dir (read-only FS,
        # permissions), still emit a valid envelope with a warning so the
        # agent knows the run_id wasn't persisted.
        state_write_failed = False
        run_id = generate_run_id()
        ctx = {
            "run_id": run_id,
            "feature_name": feature,
            "branch": branch,
            "task": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "parent_run_id": None,
            "spec_path": spec,
        }

        try:
            STATE_DIR.mkdir(parents=True, exist_ok=True)
            HISTORY_DIR.mkdir(parents=True, exist_ok=True)
            CURRENT_FILE.write_text(json.dumps(ctx, indent=2))
            (HISTORY_DIR / f"{run_id}.json").write_text(json.dumps(ctx, indent=2))
        except Exception:
            state_write_failed = True

        warn = " | WARN: state dir unwritable" if state_write_failed else ""
        extra_warnings = ""
        if brand_warn:
            extra_warnings += f" | {brand_warn}"
        if agents_warn:
            extra_warnings += f" | {agents_warn}"
        additional_context = (
            f"Run ID: {run_id} | branch: {branch or 'unknown'} | "
            f"feature: {feature or 'none'} | Tracking: {tracking} | "
            f"dashboard: /dev-kit/runs/{run_id}{warn}{extra_warnings}"
        )
        emit_envelope(additional_context)
        return 0
    except Exception as e:
        # Never block Claude Code on a hook failure. Still emit a valid
        # envelope so the agent sees SOMETHING confirming the hook ran.
        try:
            emit_envelope(f"session-start-run soft-failed: {e}")
        except Exception:
            pass
        print(f"[session-start-run] soft-failed: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    _started_at = datetime.now(timezone.utc)
    _rc = main()
    _dur_ms = int((datetime.now(timezone.utc) - _started_at).total_seconds() * 1000)
    log_kit_event(
        "session-start-run",
        phase="end",
        outcome="ok" if _rc == 0 else "fail",
        duration_ms=_dur_ms,
    )
    sys.exit(_rc)
