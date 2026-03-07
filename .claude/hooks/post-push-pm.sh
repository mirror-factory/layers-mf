#!/usr/bin/env bash
# Post-push PM agent hook
# Triggered as an async PostToolUse hook on Bash commands.
# Self-filters: only acts on `git push` commands.

set -euo pipefail

# Read stdin (Claude Code hook JSON payload)
INPUT=$(cat)

# Extract the command that was run
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null)

# Only proceed if this was a git push
if ! echo "$COMMAND" | grep -qE '^\s*git\s+push'; then
    exit 0
fi

# --- This is a git push — activate PM agent ---

LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/pm-agent.log"
CONFIG_FILE="$CLAUDE_PROJECT_DIR/.claude/agents/pm-config.json"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=== PM Agent triggered ==="
log "Command: $COMMAND"

# Extract push output from tool_response to find SHA range
PUSH_OUTPUT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # tool_response may be nested; try common shapes
    resp = d.get('tool_response', {})
    if isinstance(resp, dict):
        print(resp.get('stdout', '') + resp.get('output', ''))
    elif isinstance(resp, str):
        print(resp)
    else:
        print('')
except:
    print('')
" 2>/dev/null)

log "Push output: $PUSH_OUTPUT"

# Try to extract SHA range from push output (e.g., abc1234..def5678)
SHA_RANGE=$(echo "$PUSH_OUTPUT" | grep -oE '[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}' | head -1 || true)

# Get current branch
BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [ -n "$SHA_RANGE" ]; then
    log "SHA range from push output: $SHA_RANGE"
    COMMIT_DATA=$(git -C "$CLAUDE_PROJECT_DIR" log "$SHA_RANGE" --pretty=format:"%H|%h|%s|%an" 2>/dev/null || true)
else
    # Fallback: use last commit
    log "No SHA range found, using last commit"
    COMMIT_DATA=$(git -C "$CLAUDE_PROJECT_DIR" log -1 --pretty=format:"%H|%h|%s|%an" 2>/dev/null || true)
fi

if [ -z "$COMMIT_DATA" ]; then
    log "No commit data found, exiting"
    exit 0
fi

log "Commits: $COMMIT_DATA"

# Check if any commits reference Linear issues
PREFIXES=$(python3 -c "
import json
try:
    with open('$CONFIG_FILE') as f:
        cfg = json.load(f)
    print('|'.join(cfg.get('team_prefixes', ['PROD', 'SERV', 'COMP'])))
except:
    print('PROD|SERV|COMP')
" 2>/dev/null)

if ! echo "$COMMIT_DATA" | grep -qEi "($PREFIXES)-[0-9]+"; then
    log "No Linear issue references found in commits, sending ntfy only"
    # Still send ntfy notification even without Linear refs
    NTFY_TOPIC=$(python3 -c "
import json
try:
    with open('$CONFIG_FILE') as f:
        print(json.load(f).get('ntfy_topic', 'layers-mf-pm'))
except:
    print('layers-mf-pm')
" 2>/dev/null)

    COMMIT_COUNT=$(echo "$COMMIT_DATA" | wc -l | tr -d ' ')
    COMMIT_LINES=""
    while IFS= read -r line; do
        SHORT_SHA=$(echo "$line" | cut -d'|' -f2)
        MSG=$(echo "$line" | cut -d'|' -f3)
        COMMIT_LINES="$COMMIT_LINES
- $SHORT_SHA: $MSG"
    done <<< "$COMMIT_DATA"

    GITHUB_URL=$(python3 -c "
import json
try:
    with open('$CONFIG_FILE') as f:
        print(json.load(f).get('github_url', 'https://github.com/mirror-factory/layers-mf'))
except:
    print('https://github.com/mirror-factory/layers-mf')
" 2>/dev/null)

    curl -s \
        -H "Title: Layers push: $BRANCH ($COMMIT_COUNT commits)" \
        -H "Tags: git,rocket" \
        -H "Click: $GITHUB_URL/commits/$BRANCH" \
        -d "$COMMIT_COUNT commits pushed to \`$BRANCH\`$COMMIT_LINES" \
        "https://ntfy.sh/$NTFY_TOPIC" >> "$LOG_FILE" 2>&1 || true

    log "ntfy notification sent (no Linear refs)"
    exit 0
fi

# Build the prompt for the PM agent
PROMPT="You have been triggered by a git push. Process these commits and update Linear.

BRANCH: $BRANCH

COMMITS:
$COMMIT_DATA

Read the config from .claude/agents/pm-config.json first, then follow your instructions to:
1. Parse Linear issue references from commit messages
2. Post comments on matched Linear issues
3. Update statuses based on trigger keywords
4. Send ntfy.sh notification summary"

log "Spawning PM agent..."

# Unset CLAUDECODE to avoid nested session error
unset CLAUDECODE 2>/dev/null || true

# Spawn PM agent asynchronously
(
    claude -p \
        --agent pm \
        --dangerously-skip-permissions \
        "$PROMPT" \
        >> "$LOG_FILE" 2>&1
    log "PM agent completed"
) &

log "PM agent spawned in background (PID: $!)"
exit 0
