#!/usr/bin/env bash
# Runs every expect plan in sequence, logs outcome to the central test checklist.
# Stops on first uncaught error so we can investigate — comment out `set -e` for a full sweep.

set -eu

EXPECT_BASE_URL="${EXPECT_BASE_URL:-http://localhost:3000}"
export EXPECT_BASE_URL

PLAN_DIR="docs/plans/expect-plans"
LOG_FILE="docs/plans/expect-run-$(date +%Y-%m-%d-%H%M).log"

echo "Running expect matrix against $EXPECT_BASE_URL"
echo "Logging to $LOG_FILE"
echo "" > "$LOG_FILE"

PLANS=(scheduling chat library mcp skills artifacts mobile tools)

for plan in "${PLANS[@]}"; do
  echo "=== $plan ===" | tee -a "$LOG_FILE"
  if [ -f "$PLAN_DIR/$plan.md" ]; then
    npx expect-cli --agent claude -m "$(cat "$PLAN_DIR/$plan.md")" -y 2>&1 | tee -a "$LOG_FILE" || \
      echo "[FAIL] $plan" | tee -a "$LOG_FILE"
  else
    echo "[SKIP] no plan file for $plan" | tee -a "$LOG_FILE"
  fi
done

echo ""
echo "Done. Log: $LOG_FILE"
echo "Update docs/plans/master-improvement-plan.md eval log with findings."
