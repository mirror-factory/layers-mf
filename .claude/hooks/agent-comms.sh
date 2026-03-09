#!/usr/bin/env bash
# Agent Communication Hook (PostToolUse)
# Automatically sends status updates to the message broker after significant tool uses.
# The other agent's PreToolUse hook picks up the message on its next action.

set -euo pipefail

INPUT=$(cat)

# Extract tool name and details
TOOL=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_name', ''))
except:
    print('')
" 2>/dev/null)

# Only report on significant tools (not Read/Grep/Glob which are just lookups)
case "$TOOL" in
  Bash|Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Extract what happened
DETAIL=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    inp = d.get('tool_input', {})
    tool = d.get('tool_name', '')
    if tool == 'Bash':
        cmd = inp.get('command', '')[:120]
        print(f'Bash: {cmd}')
    elif tool == 'Edit':
        fp = inp.get('file_path', '')
        print(f'Edit: {fp}')
    elif tool == 'Write':
        fp = inp.get('file_path', '')
        print(f'Write: {fp}')
    elif tool == 'NotebookEdit':
        fp = inp.get('notebook_path', '')
        print(f'NotebookEdit: {fp}')
    else:
        print(tool)
except:
    print('unknown')
" 2>/dev/null)

# Determine which pane we're in to set the sender/channel
CURRENT_PANE=$(tmux display-message -p '#P' 2>/dev/null || echo "unknown")

if [ "$CURRENT_PANE" = "0" ]; then
  FROM="pm"
  CHANNEL="dev"
elif [ "$CURRENT_PANE" = "1" ]; then
  FROM="dev"
  CHANNEL="pm"
else
  exit 0
fi

# Send to message broker (non-blocking, fire and forget)
curl -s --max-time 1 \
  -H "X-From: $FROM" \
  -d "[auto] $DETAIL" \
  "http://localhost:9876/send/$CHANNEL" >/dev/null 2>&1 || true

exit 0
