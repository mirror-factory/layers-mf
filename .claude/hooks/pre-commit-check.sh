#!/bin/bash
# Pre-commit hook for Claude Code
# Runs typecheck before any commit is allowed
# Lint runs in CI (GitHub Actions) — next lint has env issues locally

set -e

export PATH="/opt/homebrew/bin:$PATH"
NODE="/opt/homebrew/bin/node"
PROJECT_DIR="$(git rev-parse --show-toplevel)"
cd "$PROJECT_DIR"

echo "Running typecheck..." >&2
$NODE node_modules/typescript/bin/tsc --noEmit 2>&1 | tail -5
TC_EXIT=${PIPESTATUS[0]}

if [ $TC_EXIT -ne 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"TypeScript errors found. Fix them before committing."}}'
  exit 0
fi

# All checks passed
exit 0
