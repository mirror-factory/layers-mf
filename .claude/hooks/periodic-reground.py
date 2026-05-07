#!/usr/bin/env python3
"""
PostToolUse hook -- re-injects working state every 7 turns.
Prevents context drift in long sessions.

Install to: .claude/hooks/periodic-reground.py
Wire in: .claude/settings.json -> hooks.PostToolUse[matcher="*"]

Copied from vercel-ai-starter-kit. Customize for your project.
"""
import json
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

STATE_FILE = Path('.claude/hooks/state.json')
REGROUND_INTERVAL = 7


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            pass
    return {'turn_count': 0}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))


def run(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def main() -> tuple[str, str | None, int]:
    """Returns (outcome, reason, turn_count)."""
    state = load_state()
    state['turn_count'] = state.get('turn_count', 0) + 1
    turn = state['turn_count']

    if turn % REGROUND_INTERVAL != 0:
        save_state(state)
        return 'skip', f'turn {turn} is not a reground interval', turn

    branch = run(['git', 'branch', '--show-current']) or '(detached)'
    status = run(['git', 'status', '--short'])
    status_count = len(status.splitlines()) if status else 0
    recent = run(['git', 'log', '--oneline', '-1']) or '(none)'

    lines = [
        f'<reground turn="{turn}">',
        f'Branch: {branch} | Uncommitted: {status_count} files | Last commit: {recent}',
        'Reminder: Follow project patterns. Run `pnpm typecheck && pnpm test` before commit.',
    ]

    # Gap 13: Every ~50 tool calls, remind to commit and push.
    if turn > 0 and turn % 50 == 0:
        lines.append(f'REMINDER: You have made ~{turn} tool calls since session start.')
        lines.append('Consider: git add + commit + push to preserve your work.')

    lines.append('</reground>')
    print('\n'.join(lines))
    save_state(state)
    return 'ok', 'injected reground context', turn


if __name__ == '__main__':
    _started_at = time.time()
    _outcome = 'ok'
    _reason: str | None = None
    _err: str | None = None
    _turn = 0
    try:
        _outcome, _reason, _turn = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'periodic-reground',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        turn=_turn,
    )
