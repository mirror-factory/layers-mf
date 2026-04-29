#!/usr/bin/env python3
"""
record-skill-use -- track every Claude Code Skill invocation.

Runs as a PreToolUse hook matcher for the Skill tool. Appends one JSONL line
to `.ai-dev-kit/state/skill-invocations.jsonl` with:
  - ts (ISO8601)
  - run_id (from .ai-dev-kit/state/current-run.json)
  - skill (name arg from the Skill tool call)
  - args (optional args string)
  - session_id (Claude Code's session id)
  - transcript_path (for later correlation)

Vercel's AGENTS.md eval showed skills auto-invoke at 79% and never-invoke at
56%. This recorder makes that measurable per-project so the team can see
which skills are actually firing. `scripts/sync-registries.ts` aggregates
the JSONL into `.ai-dev-kit/registries/skills.yaml` with invocation_count +
last_invoked_at, which `onboard` surfaces in AGENTS.md Kit Catalog.

Silent on any error -- hooks must never break Claude Code.
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# 0.2.18: kit-audit log fan-out. Importable from sibling record-kit-event.py
# so each Claude hook invocation is recorded in .ai-dev-kit/state/kit-audit.jsonl.
# Never raises -- audit failures can't block the hook.
sys.path.insert(0, str(Path(__file__).parent))
try:
    from record_kit_event import log_kit_event  # type: ignore
except Exception:
    def log_kit_event(*_a, **_kw):  # type: ignore
        pass


STATE_FILE = Path(".ai-dev-kit/state/current-run.json")
LOG_FILE = Path(".ai-dev-kit/state/skill-invocations.jsonl")


def load_run_id() -> str | None:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text()).get("run_id")
    except Exception:
        return None


def main() -> tuple[int, str, str | None, str | None, str | None]:
    """Returns (exit_code, outcome, reason, skill, error)."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0, 'skip', 'empty stdin', None, None

        payload = json.loads(raw)

        # Only record Skill tool invocations.
        tool_name = payload.get("tool_name") or payload.get("toolName")
        if tool_name != "Skill":
            return 0, 'skip', f'tool_name={tool_name!r} is not Skill', None, None

        tool_input = payload.get("tool_input") or payload.get("toolInput") or {}
        skill = tool_input.get("skill")
        if not skill:
            return 0, 'skip', 'no skill name in tool_input', None, None

        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": load_run_id(),
            "skill": skill,
            "args": tool_input.get("args"),
            "session_id": payload.get("session_id") or payload.get("sessionId"),
            "transcript_path": payload.get("transcript_path") or payload.get("transcriptPath"),
        }

        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a") as f:
            f.write(json.dumps(record) + "\n")

        return 0, 'ok', None, str(skill), None
    except Exception as e:
        print(f"[record-skill-use] soft-failed: {e}", file=sys.stderr)
        return 0, 'fail', 'hook soft-failed', None, str(e)


if __name__ == "__main__":
    _started_at = time.time()
    _rc, _outcome, _reason, _skill, _err = 0, 'ok', None, None, None
    try:
        _rc, _outcome, _reason, _skill, _err = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'record-skill-use',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        skill=_skill,
    )
    sys.exit(_rc)
