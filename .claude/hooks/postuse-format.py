#!/usr/bin/env python3
"""
PostToolUse Write|Edit hook -- auto-format changed files with prettier.
Fails silently if prettier is not installed. Non-blocking.

Install to: .claude/hooks/postuse-format.py
Wire in: .claude/settings.json -> hooks.PostToolUse[matcher="Write|Edit"]

Copied from vercel-ai-starter-kit. Customize for your project.
"""
import os
import subprocess
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

SUPPORTED_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css'}


def main() -> tuple[str, str | None, int]:
    """Returns (outcome, reason, files_formatted)."""
    file_paths = os.environ.get('CLAUDE_FILE_PATHS', '')
    if not file_paths:
        return 'skip', 'no CLAUDE_FILE_PATHS in env', 0

    formatted = 0
    for path in file_paths.split(':'):
        path = path.strip()
        if not path:
            continue
        if not any(path.endswith(ext) for ext in SUPPORTED_EXTS):
            continue

        try:
            subprocess.run(
                ['pnpm', 'exec', 'prettier', '--write', path],
                capture_output=True,
                timeout=15,
            )
            formatted += 1
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass

    if formatted == 0:
        return 'skip', 'no files with supported extensions', 0
    return 'ok', None, formatted


if __name__ == '__main__':
    _started_at = time.time()
    _outcome = 'ok'
    _reason: str | None = None
    _err: str | None = None
    _formatted = 0
    try:
        _outcome, _reason, _formatted = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'postuse-format',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        files_formatted=_formatted,
    )
