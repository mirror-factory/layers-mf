#!/usr/bin/env python3
"""
PostToolUse Bash hook — tracks which verification commands were actually run.
Completely silent — no output. Records timestamps in state.json so that
verify-before-stop.py can check: "You edited an API route but never ran tests."

As of kit 0.1.11, the command -> key map is DYNAMIC: this hook reads
.ai-dev-kit/observability-requirements.yaml's `verification_commands`
section. Projects add their own commands without editing the kit.

Install to: .claude/hooks/verify-claims.py
Wire in: .claude/settings.json -> hooks.PostToolUse[matcher="Bash"]

Copied from vercel-ai-starter-kit. Do not edit.
"""
import json
import os
import re
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

STATE_FILE = Path('.claude/hooks/state.json')
REQUIREMENTS_FILE = Path('.ai-dev-kit/observability-requirements.yaml')
TDD_LOG = Path('.ai-dev-kit/state/tdd-log.jsonl')
RUN_STATE_FILE = Path('.ai-dev-kit/state/current-run.json')

# Commands that run tests and may produce a TDD red/green signal.
TDD_TEST_PATTERNS = (
    re.compile(r'vitest\s+(?:run\s+)?(\S+\.test\.(?:ts|tsx|mts|mjs|js))'),
    re.compile(r'vitest\s+run\s+(\S+)'),
    re.compile(r'pnpm\s+test\s+(\S+)'),
    re.compile(r'npx\s+vitest\s+(?:run\s+)?(\S+)'),
)

# Legacy fallback when the YAML isn't present. Kept so 0.1.10-era projects
# still record verification timestamps.
LEGACY_COMMANDS = {
    'pnpm test': 'test',
    'npx vitest': 'test',
    'pnpm typecheck': 'typecheck',
    'npx tsc': 'typecheck',
    'pnpm test:e2e': 'e2e',
    'npx playwright': 'e2e',
    'pnpm storybook:build': 'storybook',
    'pnpm storybook': 'storybook',
    'pnpm build': 'build',
    'pnpm test:ai': 'ai-test',
    'pnpm eval:chat': 'eval-chat',
    'pnpm eval': 'eval',
    'curl ': 'curl',
    'pnpm dev': 'dev-server',
    'pnpm gates': 'gates',
    'pnpm lint': 'lint',
    'curl http://localhost': 'route-exercise',
    'curl localhost:': 'route-exercise',
    'pnpm test:api': 'route-exercise',
    'npx start-server-and-test': 'route-exercise',
    'playwright test tests/api': 'route-exercise',
    'vitest run tests/api': 'route-exercise',
    'pnpm test:route': 'route-exercise',
}


def load_command_map() -> dict[str, str]:
    """Read verification_commands from observability-requirements.yaml.
    Minimal parser -- the section is flat key:value pairs so no nested parsing.
    Falls back to LEGACY_COMMANDS if file missing.
    """
    if not REQUIREMENTS_FILE.exists():
        return LEGACY_COMMANDS

    try:
        text = REQUIREMENTS_FILE.read_text()
    except OSError:
        return LEGACY_COMMANDS

    commands = dict(LEGACY_COMMANDS)  # start from legacy so none lost
    in_section = False
    for raw in text.split('\n'):
        line = raw.rstrip()
        stripped = line.strip()

        if line.startswith('verification_commands:'):
            in_section = True
            continue
        if in_section and line and not line[0].isspace() and not stripped.startswith('#'):
            # Next top-level section.
            in_section = False
            continue
        if not in_section or not stripped or stripped.startswith('#'):
            continue

        # Parse 'key': value or key: value
        if ':' in stripped:
            k, v = stripped.split(':', 1)
            k = k.strip().strip("'\"")
            v = v.strip().strip("'\"")
            if k and v:
                commands[k] = v

    return commands


def _load_run_id() -> str | None:
    if not RUN_STATE_FILE.exists():
        return None
    try:
        return json.loads(RUN_STATE_FILE.read_text()).get('run_id')
    except Exception:
        return None


def _record_tdd(command: str, input_data: dict) -> None:
    """Detect test-run commands and append a red/green entry to tdd-log.jsonl.

    check-tdd.ts requires a "red" (non-zero exit) before a matching "green"
    (zero exit) for each implementation file. Exit code comes from the
    PostToolUse payload when available. No payload -> skip (we never record
    fake results).
    """
    # Find the test-file argument in the command.
    test_file = None
    for pat in TDD_TEST_PATTERNS:
        m = pat.search(command)
        if m:
            test_file = m.group(1)
            break
    if not test_file:
        return

    # Exit code from hook payload. Claude Code surfaces tool_result.exit_code or
    # similar; we read whatever we can find.
    exit_code = None
    tr = input_data.get('tool_result') or input_data.get('toolResult') or {}
    if isinstance(tr, dict):
        exit_code = tr.get('exit_code') or tr.get('exitCode')
    if exit_code is None:
        # Heuristic fallback: presence of "FAIL" / "error" in stdout means red.
        text = ''
        if isinstance(tr, dict):
            text = str(tr.get('stdout', '')) + str(tr.get('stderr', ''))
        if 'FAIL' in text or 'failed' in text.lower() or 'error' in text.lower():
            exit_code = 1
        elif 'PASS' in text or 'passed' in text.lower() or ' ok ' in text.lower():
            exit_code = 0
        else:
            return  # can't tell; don't log a speculative entry

    status = 'red' if exit_code != 0 else 'green'
    # Corresponding implementation file = test_file with .test. stripped.
    impl_file = re.sub(r'\.test\.(ts|tsx|mts|mjs|js)$', r'.\1', test_file)

    record = {
        'ts': datetime.now(timezone.utc).isoformat(),
        'run_id': _load_run_id(),
        'file': impl_file,
        'test_file': test_file,
        'status': status,
        'exit_code': exit_code,
    }
    try:
        TDD_LOG.parent.mkdir(parents=True, exist_ok=True)
        with TDD_LOG.open('a') as f:
            f.write(json.dumps(record) + '\n')
    except Exception:
        pass


def main() -> tuple[str, str | None, str | None]:
    """Returns (outcome, reason, matched_key)."""
    try:
        input_data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, IOError):
        input_data = {}

    command = input_data.get('tool_input', {}).get('command', '')
    if not command:
        command = os.environ.get('CLAUDE_BASH_COMMAND', '')
    if not command:
        return 'skip', 'no Bash command in payload', None

    _record_tdd(command, input_data)

    command_map = load_command_map()

    # Longest-prefix match so 'pnpm test:visual --project=mobile-dark'
    # takes precedence over 'pnpm test'. Sort by descending length.
    matched_key = None
    for pattern in sorted(command_map.keys(), key=len, reverse=True):
        if pattern in command:
            matched_key = command_map[pattern]
            break

    if not matched_key:
        return 'skip', 'command did not match any verification pattern', None

    try:
        state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    except json.JSONDecodeError:
        state = {}

    if 'last_verified' not in state:
        state['last_verified'] = {}

    state['last_verified'][matched_key] = time.time()
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))
    return 'ok', f'recorded verification: {matched_key}', matched_key


if __name__ == '__main__':
    _started_at = time.time()
    _outcome = 'ok'
    _reason: str | None = None
    _matched: str | None = None
    _err: str | None = None
    try:
        _outcome, _reason, _matched = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'verify-claims',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        matched_key=_matched,
    )
