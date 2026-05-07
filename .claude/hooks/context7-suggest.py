#!/usr/bin/env python3
"""
PreToolUse Write|Edit hook -- FORCE a Context7 / docs lookup before editing
files that touch flagged vendor libraries.

This hook used to be advisory (warned to stderr, never blocked). The
AssemblyAI `speech_model -> speech_models` incident showed advisory wasn't
enough: the agent guessed at model IDs rather than looking them up, shipped
deprecated code, and the user caught the bug in production.

Policy now:
  - If the file being written/edited imports a flagged library
  - AND the session has no recorded Context7 lookup (or equivalent docs
    read via WebFetch / vendor docs URL) for that library in the last hour
  - BLOCK (exit 2). Agent must run a Context7 lookup first.

The session's lookup ledger lives in .claude/hooks/state.json under
`docs_lookups`: { "<library>": <timestamp> }. track-edits.py and
verify-claims.py already use this state file -- we extend it.

Bypass (for edge cases): set CONTEXT7_BYPASS=1 in the environment or add
the file path to .claude/hooks/context7-allowlist.txt. This is intended
for library-owning code that IS the docs source.
"""
import json
import os
import re
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
ALLOWLIST_FILE = Path('.claude/hooks/context7-allowlist.txt')

# Libraries that have churned enough in recent memory to require a fresh
# lookup before edits. Keep the list tight -- overuse will train agents
# to bypass the block.
# Base list of libraries that have churned enough to require fresh docs
# before edits. Extended dynamically in _flagged_libraries() from:
#   1. package.json dependencies + devDependencies
#   2. .ai-dev-kit/registries/*.json vendor entries
# 0.2.9: the dynamic extension closes the "agent edits a new SDK not on
# the hardcoded list -> no block" gap. Every external dependency in the
# project is now gated by default.
BASE_FLAGGED_LIBRARIES = [
    'assemblyai',
    '@ai-sdk/',
    'ai',                     # Vercel AI SDK
    'langfuse',
    '@langfuse/',
    '@deepgram/sdk',
    '@anthropic-ai/sdk',
    '@anthropic-ai/claude-agent-sdk',
    'openai',
    '@google/generative-ai',
]

LOOKUP_FRESHNESS_SECONDS = 604800  # 7 days -- 0.2.14 bumped from 3600 (1 hour).
# Rationale: the 1-hour window was too tight. Real workflow is: agent checks
# docs at session start, works for a few hours, commits. 1-hour TTL made
# the gate feel punitive without catching real staleness. 7 days matches
# the pace at which vendor SDKs actually ship breaking changes; shorter
# than the weekly cost-drift GH Action so a stale lookup always fails at
# least one layer of enforcement.

# Standard-library / build-tool packages we explicitly DON'T gate. These
# don't churn fast enough to need a Context7 lookup per edit.
DO_NOT_FLAG = {
    'react', 'react-dom', 'next', 'typescript', 'node', '@types/node',
    '@types/react', '@types/react-dom', 'eslint', 'prettier', 'vitest',
    '@playwright/test', 'playwright', 'tailwindcss', 'postcss', 'autoprefixer',
    'tsx', 'zod', 'clsx', 'lucide-react', 'class-variance-authority',
}


def _flagged_libraries() -> list[str]:
    """Compose the flagged list from BASE + package.json + registries.

    Cached per-process via a module-level flag so multiple hook calls in
    the same Claude Code session reuse the result.
    """
    global _FLAGGED_CACHE
    try:
        if _FLAGGED_CACHE is not None:
            return _FLAGGED_CACHE
    except NameError:
        pass

    flagged = list(BASE_FLAGGED_LIBRARIES)

    # Union package.json deps.
    pkg_path = Path('package.json')
    if pkg_path.exists():
        try:
            pkg = json.loads(pkg_path.read_text())
            for section in ('dependencies', 'devDependencies', 'peerDependencies'):
                for dep in (pkg.get(section) or {}).keys():
                    if dep in DO_NOT_FLAG:
                        continue
                    if dep.startswith('@types/'):
                        continue
                    if dep not in flagged:
                        flagged.append(dep)
        except (json.JSONDecodeError, OSError):
            pass

    # Union registry vendor names (.ai-dev-kit/registries/*.json).
    reg_dir = Path('.ai-dev-kit/registries')
    if reg_dir.exists():
        for f in reg_dir.glob('*.json'):
            if f.name == 'registry.schema.json':
                continue
            try:
                data = json.loads(f.read_text())
                vendor = data.get('vendor')
                if isinstance(vendor, str) and vendor and vendor not in flagged:
                    flagged.append(vendor)
            except (json.JSONDecodeError, OSError):
                pass

    _FLAGGED_CACHE = flagged
    return flagged


_FLAGGED_CACHE: list[str] | None = None


# Retained for backward compat. External callers still resolve through
# the function above.
FLAGGED_LIBRARIES = BASE_FLAGGED_LIBRARIES

IMPORT_RE = re.compile(r'''from\s+['"`]([^'"`]+)['"`]''')


def libraries_in_file(path: str) -> list[str]:
    p = Path(path)
    if not p.exists() or not p.is_file():
        return []
    try:
        content = p.read_text(errors='replace')
    except OSError:
        return []
    found: list[str] = []
    # Resolve the dynamic flagged list (BASE + package.json + registries).
    flagged = _flagged_libraries()
    for m in IMPORT_RE.finditer(content):
        imp = m.group(1)
        for flag in flagged:
            if imp == flag or imp.startswith(flag) or imp.startswith(flag + '/'):
                if flag not in found:
                    found.append(flag)
    return found


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text())
    except json.JSONDecodeError:
        return {}


def is_allowlisted(path: str) -> bool:
    if os.environ.get('CONTEXT7_BYPASS') == '1':
        return True
    if not ALLOWLIST_FILE.exists():
        return False
    try:
        for line in ALLOWLIST_FILE.read_text().splitlines():
            s = line.strip()
            if not s or s.startswith('#'):
                continue
            if path == s or path.endswith(s):
                return True
    except OSError:
        return False
    return False


def main() -> tuple[int, str, str | None, list[str]]:
    """Returns (exit_code, outcome, reason, missing_libs).

    outcome is one of 'ok' | 'skip' | 'fail':
      - 'ok'    = ran, no block required (agent may proceed)
      - 'skip'  = short-circuited (no stdin / no file / allowlisted / no flagged libs / lookups fresh)
      - 'fail'  = blocked (exit 2) -- agent must perform a docs lookup first
    """
    try:
        payload = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, IOError):
        return 0, 'skip', 'invalid or missing stdin payload', []

    tool_input = payload.get('tool_input') or {}
    file_path = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
    if not file_path:
        return 0, 'skip', 'no file_path in tool_input', []

    if is_allowlisted(file_path):
        return 0, 'skip', 'path allowlisted (CONTEXT7_BYPASS or context7-allowlist.txt)', []

    flagged = libraries_in_file(file_path)
    if not flagged:
        return 0, 'skip', 'no flagged libs in input', []

    state = load_state()
    lookups = state.get('docs_lookups', {})
    now = time.time()

    missing: list[str] = []
    for lib in flagged:
        last = lookups.get(lib, 0)
        if now - last > LOOKUP_FRESHNESS_SECONDS:
            missing.append(lib)

    if not missing:
        return 0, 'ok', 'flagged libs had fresh docs lookups', []

    # BLOCK. Exit code 2 prevents the tool use; stderr is surfaced to the agent.
    sys.stderr.write(
        'BLOCKED: {path} imports libraries that require a fresh docs lookup: {libs}\n'
        '\n'
        'These libraries have shipped breaking changes in recent months and'
        ' must be verified against current docs before editing. Run one of:\n'
        '\n'
        '  - Context7 MCP lookup: @context7 resolve {libs_csv} then @context7 get-docs\n'
        '  - Direct docs fetch: WebFetch the vendor docs URL (assemblyai.com/docs,\n'
        '    docs.anthropic.com, ai-sdk.dev, etc.)\n'
        '  - Registry lookup: validModels() / assertValidModel() from @/lib/registry\n'
        '\n'
        'After a successful lookup, record_docs_lookup.py is invoked by\n'
        'PostToolUse on WebFetch / MCP calls to flagged-library URLs, updating\n'
        'state.json. If you already did a lookup and this still fires, record it\n'
        'manually:\n'
        '  python3 .claude/hooks/record-docs-lookup.py {libs_csv}\n'
        '\n'
        'Emergency bypass (use sparingly): CONTEXT7_BYPASS=1 before the edit\n'
        'or add {path} to .claude/hooks/context7-allowlist.txt.\n'.format(
            path=file_path, libs=', '.join(missing), libs_csv=','.join(missing),
        )
    )
    return 2, 'fail', 'blocked edit to {libs} without docs lookup'.format(libs=', '.join(missing)), missing


if __name__ == '__main__':
    _started_at = time.time()
    _exit_code = 0
    _outcome = 'ok'
    _reason: str | None = None
    _missing: list[str] = []
    _err_str: str | None = None
    try:
        _exit_code, _outcome, _reason, _missing = main()
    except Exception as e:
        # Never break Claude Code. Keep exit code 0 (advisory posture) and log.
        _outcome = 'fail'
        _err_str = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'context7-suggest',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err_str,
        duration_ms=int((time.time() - _started_at) * 1000),
        missing_libs=_missing if _missing else None,
    )
    sys.exit(_exit_code)
