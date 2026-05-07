#!/usr/bin/env python3
"""
Stop hook -- blocks the agent from finishing if edited files require
runtime verification that hasn't been performed yet.

As of kit 0.1.11, rules are DYNAMIC: this hook reads
.ai-dev-kit/observability-requirements.yaml for the authoritative
list of file-pattern -> required-verification-key mappings. That way
projects can extend the rules without editing the kit.

If the YAML is missing, the hook falls back to the legacy hardcoded
rules (API routes + AI pipeline) so existing projects still get some
enforcement.

Exit codes:
  0 -- continue (nothing needs verification, or already verified)
  2 -- BLOCK (edited files need runtime verification before stopping)

How it works:
  1. Reads state.json for files edited this session
  2. Reads .ai-dev-kit/observability-requirements.yaml for
     ui_coverage rules (file glob -> required keys)
  3. Checks last_verified timestamps for each required key
  4. If any required key is stale or missing, BLOCK with exact fix

The command-to-key map also lives in the YAML's verification_commands
section, consulted by verify-claims.py.
"""
import fnmatch
import json
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
REQUIREMENTS_FILE = Path('.ai-dev-kit/observability-requirements.yaml')

# Fallback legacy rules when the YAML isn't present. Kept so 0.1.10-era
# projects still get enforcement.
LEGACY_RULES = [
    {
        'pattern': 'app/api/',
        'label': 'API route',
        'requires': ['test', 'typecheck', 'route-exercise'],
        'suggest': (
            'Run `pnpm typecheck && pnpm test && pnpm test:api`. A real '
            'route-exercise is required -- mocked unit tests are not enough.'
        ),
    },
    {
        'pattern': 'lib/ai/',
        'label': 'AI pipeline code',
        'requires': ['test', 'typecheck'],
        'suggest': 'Run `pnpm typecheck && pnpm test`.',
    },
    {
        'pattern': 'components/',
        'label': 'UI component',
        'requires': ['typecheck'],
        'suggest': 'Run `pnpm typecheck`.',
    },
    {
        'pattern': 'lib/',
        'label': 'Shared library',
        'requires': ['test'],
        'suggest': 'Run `pnpm test`.',
    },
]


def load_yaml_rules() -> list[dict]:
    """Parse observability-requirements.yaml into a list of rule dicts.
    Minimal parser -- supports the narrow shapes the kit uses, no PyYAML dep.
    Falls back to LEGACY_RULES if file missing or malformed.
    """
    if not REQUIREMENTS_FILE.exists():
        return LEGACY_RULES
    try:
        text = REQUIREMENTS_FILE.read_text()
    except OSError:
        return LEGACY_RULES

    rules = []
    in_ui = False
    cur_rule = None

    for raw in text.split('\n'):
        line = raw.rstrip()
        if line.startswith('ui_coverage:'):
            in_ui = True
            continue
        if in_ui and line and not line.startswith(' ') and not line.startswith('\t'):
            in_ui = False
            if cur_rule:
                rules.append(cur_rule)
                cur_rule = None
            continue
        if not in_ui:
            continue

        stripped = line.strip()
        if stripped.startswith('- name:'):
            if cur_rule:
                rules.append(cur_rule)
            cur_rule = {
                'name': stripped.split(':', 1)[1].strip(),
                'applies_to': [],
                'requires': [],
            }
            cur_section = None
        elif cur_rule is None:
            continue
        elif stripped == 'applies_to:':
            cur_section = 'applies_to'
        elif stripped == 'requires:':
            cur_section = 'requires'
        elif stripped.startswith('- ') and cur_section:
            val = stripped[2:].strip().strip('"\'')
            cur_rule[cur_section].append(val)

    if cur_rule:
        rules.append(cur_rule)

    # Convert to the legacy-compatible shape so the matcher below is uniform.
    out = []
    for r in rules:
        for glob_pattern in r.get('applies_to', []):
            out.append({
                'pattern': glob_pattern,
                'label': r.get('name', glob_pattern),
                'requires': r.get('requires', []),
                'suggest': _suggest_for_requires(r.get('requires', [])),
                'is_glob': True,
            })

    return out if out else LEGACY_RULES


def _suggest_for_requires(keys: list[str]) -> str:
    """Generate a one-line fix suggestion from the required keys."""
    cmd_for = {
        'typecheck': 'pnpm typecheck',
        'test': 'pnpm test',
        'e2e': 'pnpm test:e2e',
        'e2e-video': 'pnpm test:e2e --video',
        'route-exercise': 'pnpm test:api OR curl http://localhost:...',
        'visual-regression-mobile': 'pnpm test:visual --project=mobile-light',
        'visual-regression-desktop': 'pnpm test:visual --project=desktop-light',
        'light-mode': 'pnpm test:light',
        'dark-mode': 'pnpm test:dark',
        'a11y': 'pnpm test:a11y',
        'storybook': 'pnpm storybook:build',
        'build': 'pnpm build',
        'ai-test': 'pnpm test:ai',
    }
    cmds = [cmd_for.get(k, f'(verify {k})') for k in keys]
    return 'Run: ' + ' && '.join(cmds)


def matches(rule: dict, file_path: str) -> bool:
    if rule.get('is_glob'):
        return fnmatch.fnmatch(file_path, rule['pattern']) or fnmatch.fnmatch(
            file_path, '**/' + rule['pattern']
        ) or _glob_match(rule['pattern'], file_path)
    return rule['pattern'] in file_path


def _glob_match(pattern: str, path: str) -> bool:
    # fnmatch doesn't treat ** the way most tooling does. Handle the common case.
    # app/**/page.tsx -> fnmatch fallback: split by **, check prefix + suffix.
    if '**' not in pattern:
        return fnmatch.fnmatch(path, pattern)
    parts = pattern.split('**')
    if len(parts) != 2:
        return False
    prefix, suffix = parts[0], parts[1]
    if not path.startswith(prefix.replace('/', '').rstrip('/')) and not prefix in path:
        pass
    return path.startswith(prefix) and path.endswith(suffix.lstrip('/'))


# How many seconds of grace for a verification to be considered fresh.
FRESHNESS_WINDOW = 300


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def main() -> tuple[int, str, str | None, int]:
    """Returns (exit_code, outcome, reason, violation_count)."""
    state = load_state()
    edited_files: dict[str, float] = state.get('edited_files', {})
    last_verified: dict[str, float] = state.get('last_verified', {})

    if not edited_files:
        return 0, 'skip', 'no edited files tracked this session', 0

    rules = load_yaml_rules()
    violations: list[dict] = []

    for file_path, edit_timestamp in edited_files.items():
        for rule in rules:
            if not matches(rule, file_path):
                continue
            missing = []
            for req_key in rule.get('requires', []):
                verified_at = last_verified.get(req_key, 0)
                if verified_at < edit_timestamp:
                    missing.append(req_key)
            if missing:
                violations.append({
                    'file': file_path,
                    'label': rule['label'],
                    'missing': missing,
                    'suggest': rule.get('suggest', 'Run the missing verifications.'),
                    'edited_ago': int(time.time() - edit_timestamp),
                })
            break

    # ── Browser verification check ──────────────────────────────────
    # Gap 16: If UI files (components/, app/) were edited but no Chrome
    # browser MCP tools were used in this session, warn or BLOCK.
    # BLOCKING (exit 2) when 3+ UI files were edited; WARNING otherwise.
    ui_files_edited = [
        f for f in edited_files
        if f.startswith('components/') or f.startswith('app/')
        or '/components/' in f or '/app/' in f
    ]
    if ui_files_edited:
        browser_tools_used = state.get('tools_used', {})
        chrome_used = any(
            k.startswith('mcp__claude-in-chrome__') or k.startswith('mcp__browser')
            for k in browser_tools_used
        )
        if not chrome_used:
            if len(ui_files_edited) >= 3:
                # Gap 16: BLOCKING when 3+ UI files modified without browser verification.
                print('BLOCKED: You modified 3+ UI files but did not test them in a browser.')
                print('  Run expect tests or open the app in a browser before claiming done.')
                print(f'  Edited UI files ({len(ui_files_edited)}): {", ".join(ui_files_edited[:5])}')
                if len(ui_files_edited) > 5:
                    print(f'  ... +{len(ui_files_edited) - 5} more')
                print('')
                return 2, 'fail', f'{len(ui_files_edited)} UI files edited without browser verification', 0
            else:
                print('WARNING: UI files were edited but no browser tools were used this session.')
                print('  The builder should verify the UI in a real browser before shipping.')
                print(f'  Edited UI files: {", ".join(ui_files_edited[:5])}')
                if len(ui_files_edited) > 5:
                    print(f'  ... +{len(ui_files_edited) - 5} more')
                print('')

    if not violations:
        return 0, 'ok', 'all edited files verified', 0

    lines = ['BLOCKED: Edited files require verification before stopping.\n']
    seen_suggestions: set[str] = set()
    for v in violations:
        missing_str = ', '.join(v['missing'])
        ago = v['edited_ago']
        ago_str = f'{ago}s ago' if ago < 120 else f'{ago // 60}m ago'
        lines.append(f"  {v['file']} ({v['label']}, edited {ago_str})")
        lines.append(f"    Missing: {missing_str}")
        if v['suggest'] not in seen_suggestions:
            lines.append(f"    Fix: {v['suggest']}")
            seen_suggestions.add(v['suggest'])
        lines.append('')

    lines.append('Run the suggested commands, then try again.')
    lines.append('Rules come from .ai-dev-kit/observability-requirements.yaml -- edit to customize.')
    print('\n'.join(lines))
    return 2, 'fail', f'{len(violations)} file(s) need verification before stop', len(violations)


if __name__ == '__main__':
    _started_at = time.time()
    _exit_code = 0
    _outcome = 'ok'
    _reason: str | None = None
    _err: str | None = None
    _violations = 0
    try:
        _exit_code, _outcome, _reason, _violations = main()
    except Exception as e:
        # Never break Claude Code on hook failure.
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'verify-before-stop',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        violations=_violations,
    )
    sys.exit(_exit_code)
