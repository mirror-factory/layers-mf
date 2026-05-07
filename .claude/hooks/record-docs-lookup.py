#!/usr/bin/env python3
"""
Record that a Context7 / docs lookup for a flagged library happened. Called
by PostToolUse on WebFetch / MCP tool calls, and manually by the agent when
it can't use a hook (bypass flow).

Usage:
  echo '<tool-payload-json>' | python3 record-docs-lookup.py          # from hook stdin
  python3 record-docs-lookup.py assemblyai,langfuse                   # manual record

Writes in two places:
  1. `.claude/hooks/state.json`  -- `docs_lookups: { <library>: <ts> }`
     (library-centric; used by verify-claims / compliance-fix)
  2. `.ai-dev-kit/state/docs-lookups.jsonl` -- run-tagged append-only log
     (run-centric; used by /dev-kit/runs/[run_id] dashboard)
"""
import json
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
RUN_STATE_FILE = Path('.ai-dev-kit/state/current-run.json')
RUN_LOG_FILE = Path('.ai-dev-kit/state/docs-lookups.jsonl')

FLAGGED_LIBRARIES = [
    'assemblyai', '@ai-sdk/', 'ai', 'langfuse', '@langfuse/',
    '@deepgram/sdk', '@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk',
    'openai', '@google/generative-ai',
]

# URL patterns that indicate a docs read for each library. The PostToolUse
# hook matches WebFetch URLs against these and records the lookup.
URL_PATTERNS = {
    'assemblyai': re.compile(r'assemblyai\.com'),
    '@ai-sdk/': re.compile(r'ai-sdk\.dev|github\.com/vercel/ai'),
    'ai': re.compile(r'ai-sdk\.dev'),
    'langfuse': re.compile(r'langfuse\.com'),
    '@langfuse/': re.compile(r'langfuse\.com'),
    '@deepgram/sdk': re.compile(r'(developers\.|docs\.)?deepgram\.com'),
    '@anthropic-ai/sdk': re.compile(r'docs\.anthropic\.com|platform\.claude\.com'),
    '@anthropic-ai/claude-agent-sdk': re.compile(r'docs\.anthropic\.com|code\.claude\.com|platform\.claude\.com'),
    'openai': re.compile(r'platform\.openai\.com|openai\.com/docs'),
    '@google/generative-ai': re.compile(r'ai\.google\.dev|aistudio\.google\.com'),
}


def _load_run_id() -> str | None:
    if not RUN_STATE_FILE.exists():
        return None
    try:
        return json.loads(RUN_STATE_FILE.read_text()).get('run_id')
    except Exception:
        return None


def record(libs: list[str], url: str | None = None, tool: str | None = None) -> None:
    # 1. Library-centric state (legacy consumers).
    STATE_FILE.parent.mkdir(exist_ok=True)
    state = {}
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            pass
    lookups = state.get('docs_lookups', {})
    now = time.time()
    for lib in libs:
        lookups[lib] = now
    state['docs_lookups'] = lookups
    STATE_FILE.write_text(json.dumps(state, indent=2))

    # 2. Run-centric JSONL (new; powers /dev-kit/runs/[run_id]).
    try:
        RUN_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'run_id': _load_run_id(),
            'libraries': libs,
            'url': url,
            'tool': tool,
        }
        with RUN_LOG_FILE.open('a') as f:
            f.write(json.dumps(entry) + '\n')
    except Exception:
        # Never break the hook on run-log failure.
        pass


def main() -> tuple[str, str | None, list[str]]:
    """Returns (outcome, reason, matched_libs)."""
    # Manual invocation: `python3 record-docs-lookup.py assemblyai,langfuse`
    if len(sys.argv) > 1 and sys.argv[1]:
        libs = [l.strip() for l in sys.argv[1].split(',') if l.strip()]
        record(libs)
        print(f'Recorded docs lookup for: {", ".join(libs)}')
        return 'ok', 'manual invocation', libs

    # Hook invocation: read tool payload from stdin, extract URL, match.
    try:
        payload = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, IOError):
        return 'skip', 'invalid or missing stdin payload', []

    tool_name = payload.get('tool_name') or payload.get('toolName') or ''
    url = payload.get('tool_input', {}).get('url', '') or payload.get('tool_input', {}).get('libraryName', '')
    if not url:
        return 'skip', 'no url/libraryName in tool_input', []

    matched = [lib for lib, pattern in URL_PATTERNS.items() if pattern.search(url)]
    # Record even unmatched lookups so the run dashboard shows all docs
    # activity (library tagging happens only for FLAGGED_LIBRARIES, but
    # run-tagged history wants the full trail).
    if matched:
        record(matched, url=url, tool=tool_name)
        return 'ok', f'recorded lookup for {", ".join(matched)}', matched
    else:
        # Log unmatched lookups run-side only.
        try:
            RUN_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            entry = {
                'ts': datetime.now(timezone.utc).isoformat(),
                'run_id': _load_run_id(),
                'libraries': [],
                'url': url,
                'tool': tool_name,
            }
            with RUN_LOG_FILE.open('a') as f:
                f.write(json.dumps(entry) + '\n')
        except Exception:
            pass
        return 'skip', 'url did not match any flagged library pattern', []


if __name__ == '__main__':
    _started_at = time.time()
    _outcome = 'ok'
    _reason: str | None = None
    _matched: list[str] = []
    _err: str | None = None
    try:
        _outcome, _reason, _matched = main()
    except Exception as e:
        _outcome = 'fail'
        _err = str(e)
        _reason = 'hook soft-failed'
    log_kit_event(
        'record-docs-lookup',
        kind='claude_hook',
        phase='end',
        outcome=_outcome,
        reason=_reason,
        error=_err,
        duration_ms=int((time.time() - _started_at) * 1000),
        matched_libs=_matched if _matched else None,
    )
