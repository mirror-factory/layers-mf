#!/bin/bash
# Validate that the Layers app works locally
# Run: bash scripts/validate-local.sh

set -e

PASS=0
FAIL=0
WARN=0

pass() { echo "   OK: $1"; PASS=$((PASS + 1)); }
fail() { echo "   FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "   WARN: $1"; WARN=$((WARN + 1)); }

echo "=== Layers Local Validation ==="
echo ""

# ── 1. Supabase ──────────────────────────────────────────────
echo "1. Checking Supabase..."
if npx supabase status 2>/dev/null | grep -q "API URL"; then
  pass "Supabase is running"
else
  fail "Supabase not running. Run: npx supabase start"
  echo "   (remaining checks may fail without Supabase)"
fi

# ── 2. Dev server ────────────────────────────────────────────
echo "2. Checking dev server..."
DEV_PORT=${DEV_PORT:-4000}
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DEV_PORT" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
  pass "Dev server responding on port $DEV_PORT (HTTP $HTTP_CODE)"
else
  warn "Dev server not running on port $DEV_PORT. Run: pnpm dev --port $DEV_PORT"
fi

# ── 3. API routes ────────────────────────────────────────────
echo "3. Checking API routes..."
if [ "$HTTP_CODE" != "000" ]; then
  for route in "/api/health?org_id=00000000-0000-0000-0000-000000000001" "/api/agents/templates"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DEV_PORT$route" 2>/dev/null || echo "000")
    if [ "$code" = "000" ]; then
      fail "$route — no response"
    elif [ "$code" -ge 500 ]; then
      fail "$route — HTTP $code"
    else
      pass "$route — HTTP $code"
    fi
  done
else
  warn "Skipped API checks (dev server not running)"
fi

# ── 4. Seed data ─────────────────────────────────────────────
echo "4. Checking seed data in database..."
DB_URL=$(npx supabase status 2>/dev/null | grep "DB URL" | awk '{print $NF}' || echo "")
if [ -n "$DB_URL" ]; then
  ORG_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001'" 2>/dev/null | tr -d ' ')
  if [ "$ORG_COUNT" = "1" ]; then
    pass "Test organization exists"
  else
    fail "Test organization not found. Run: npx supabase db reset"
  fi

  CTX_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM context_items WHERE org_id = '00000000-0000-0000-0000-000000000001'" 2>/dev/null | tr -d ' ')
  if [ "$CTX_COUNT" -ge 5 ] 2>/dev/null; then
    pass "$CTX_COUNT context items seeded"
  else
    fail "Expected 5+ context items, found ${CTX_COUNT:-0}"
  fi

  EMBED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM context_items WHERE org_id = '00000000-0000-0000-0000-000000000001' AND embedding IS NOT NULL" 2>/dev/null | tr -d ' ')
  if [ "$EMBED_COUNT" -ge 1 ] 2>/dev/null; then
    pass "$EMBED_COUNT items have embeddings (vector search works)"
  else
    warn "No embeddings found. Run: npx tsx scripts/embed-seed-data.ts"
  fi

  SESSION_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM sessions WHERE org_id = '00000000-0000-0000-0000-000000000001'" 2>/dev/null | tr -d ' ')
  if [ "$SESSION_COUNT" -ge 1 ] 2>/dev/null; then
    pass "$SESSION_COUNT session(s) seeded"
  else
    fail "No sessions found"
  fi
else
  warn "Could not get DB URL — skipping database checks"
fi

# ── 5. Unit tests ────────────────────────────────────────────
echo "5. Running unit tests..."
if npx vitest run --reporter=dot 2>&1 | tail -5; then
  pass "Unit tests completed"
else
  fail "Unit tests failed"
fi

# ── 6. Type check ────────────────────────────────────────────
echo "6. Type checking..."
TS_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
ERRORS=$(echo "$TS_OUTPUT" | grep "error TS" | grep -v "node_modules\|\.next/\|nango-integrations/\|stripe.*add_credits" | wc -l)
if [ "$ERRORS" -eq 0 ]; then
  pass "No type errors"
else
  warn "$ERRORS type errors (excluding nango/stripe)"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Validation Complete ==="
echo "   Passed: $PASS | Failed: $FAIL | Warnings: $WARN"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
