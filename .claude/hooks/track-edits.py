#!/usr/bin/env python3
"""
PostToolUse Write|Edit hook — records which files were edited and when.
Completely silent — no output. Writes to state.json so that
verify-before-stop.py can check if verification was run after edits.

Install to: .claude/hooks/track-edits.py
Wire in: .claude/settings.json -> hooks.PostToolUse[matcher="Write|Edit"]

Copied from vercel-ai-starter-kit. No customization needed.
"""
import json
import os
import sys
import time
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

STATE_FILE = Path('.claude/hooks/state.json')


def main() -> tuple[str, str | None, int]:
    """Returns (outcome, reason, files_tracked)."""
    file_paths = os.environ.get('CLAUDE_FILE_PATHS', '')
    if not file_paths:
        return 'skip', 'no CLAUDE_FILE_PATHS in env', 0

    try:
        state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    except json.JSONDecodeError:
        state = {}

    if 'edited_files' not in state:
        state['edited_files'] = {}

    now = time.time()
    tracked = 0
    for path in file_paths.split(':'):
        path = path.strip()
        if path:
            state['edited_files'][path] = now
            tracked += 1

    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))
    return 'ok', None, tracked


if __name__ == '__main__':
    _started_at = time.time()
    _outcome = 'ok'
    _reason: str | None = None
    _err: str | None = None
    _tracked = 0
    try:
        _outcome, _reason, _tracked = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'track-edits',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        files_tracked=_tracked,
    )
