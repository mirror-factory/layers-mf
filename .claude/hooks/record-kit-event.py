#!/usr/bin/env python3
"""
kit-audit python helper -- importable by other Claude Code hooks and usable
as a standalone CLI. Appends one JSONL event per call to
.ai-dev-kit/state/kit-audit.jsonl. Never fails.

Usage (library):
    from record_kit_event import log_kit_event
    log_kit_event("session-start-run", phase="end", outcome="ok", run_id_minted=True)

Usage (CLI):
    python3 .claude/hooks/record-kit-event.py session-start-run --phase end --outcome ok
    python3 .claude/hooks/record-kit-event.py verify-claims --outcome fail --reason "spec mismatch"
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

STATE = Path(".ai-dev-kit/state")
LOG = STATE / "kit-audit.jsonl"
ROTATED = STATE / "kit-audit.jsonl.1"
CURRENT_RUN = STATE / "current-run.json"
MAX_SIZE = 10 * 1024 * 1024  # 10 MB -- matches lib/kit-audit.ts


def _run_id() -> str | None:
    try:
        if not CURRENT_RUN.exists():
            return None
        data = json.loads(CURRENT_RUN.read_text(encoding="utf-8"))
        rid = data.get("run_id")
        return rid if isinstance(rid, str) else None
    except Exception:
        return None


def _iso_now() -> str:
    # ISO 8601 UTC with ms precision so it matches the TS writer.
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(datetime.now(timezone.utc).microsecond / 1000):03d}Z"


def _rotate_if_needed() -> None:
    try:
        if not LOG.exists():
            return
        if LOG.stat().st_size <= MAX_SIZE:
            return
        # Drop prior rotation (we keep only the last).
        try:
            if ROTATED.exists():
                ROTATED.unlink()
        except Exception:
            pass
        LOG.rename(ROTATED)
    except Exception:
        pass


def log_kit_event(
    name: str,
    phase: str | None = None,
    outcome: str | None = None,
    reason: str | None = None,
    kind: str = "claude_hook",
    step: str | None = None,
    duration_ms: int | None = None,
    error: str | None = None,
    **meta,
) -> None:
    """Append a single KitAuditEvent JSONL line. Never raises."""
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        _rotate_if_needed()
        ev: dict = {
            "ts": _iso_now(),
            "run_id": _run_id(),
            "kind": kind,
            "name": name,
        }
        if phase:
            ev["phase"] = phase
        if step:
            ev["step"] = step
        if outcome:
            ev["outcome"] = outcome
        if duration_ms is not None:
            try:
                ev["duration_ms"] = max(0, int(duration_ms))
            except Exception:
                pass
        if error:
            # First line, truncated to 500 chars -- matches TS writer contract.
            first = str(error).splitlines()[0] if str(error).splitlines() else ""
            ev["error"] = first[:500]
        if reason:
            ev["reason"] = str(reason)
        if meta:
            ev["meta"] = meta
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(ev, separators=(",", ":")) + "\n")
    except Exception:
        # Never break the calling hook.
        pass


def _main(argv: list[str]) -> int:
    import argparse

    p = argparse.ArgumentParser(description="record a kit-audit event (claude_hook default)")
    p.add_argument("name", help="event name (hook name or step identifier)")
    p.add_argument("--kind", default="claude_hook", choices=[
        "cli_command", "husky_hook", "claude_hook", "dashboard_api",
        "doctor_check", "git_state", "bootstrap_step",
    ])
    p.add_argument("--phase", choices=["start", "step", "end"])
    p.add_argument("--step")
    p.add_argument("--outcome", choices=["ok", "fail", "warn", "skip", "empty"])
    p.add_argument("--duration-ms", type=int)
    p.add_argument("--reason")
    p.add_argument("--error")
    args = p.parse_args(argv)

    log_kit_event(
        name=args.name,
        kind=args.kind,
        phase=args.phase,
        step=args.step,
        outcome=args.outcome,
        duration_ms=args.duration_ms,
        reason=args.reason,
        error=args.error,
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(_main(sys.argv[1:]))
    except Exception:
        # Refuse to error out even on argparse catastrophe.
        sys.exit(0)
