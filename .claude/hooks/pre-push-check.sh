#!/bin/bash
# Pre-push hook for Claude Code
# Runs full test suite before allowing git push

set -e

export PATH="/opt/homebrew/bin:$PATH"
NODE="/opt/homebrew/bin/node"
PROJECT_DIR="$(git rev-parse --show-toplevel)"
cd "$PROJECT_DIR"

echo "Running tests before push..." >&2
$NODE node_modules/.bin/vitest run 2>&1 | tail -10
TEST_EXIT=${PIPESTATUS[0]}

if [ $TEST_EXIT -ne 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Tests failed. Fix them before pushing."}}'
  exit 0
fi

# All checks passed
exit 0
