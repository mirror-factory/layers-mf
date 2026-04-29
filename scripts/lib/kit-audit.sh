#!/usr/bin/env bash
# kit-audit bash helper -- sourced by husky hooks to log step outcomes into
# .ai-dev-kit/state/kit-audit.jsonl alongside the TS writer. Never fails.
# Robust on BSD (macOS) and GNU date. Exit 0 always.
#
# Usage:
#   source scripts/lib/kit-audit.sh
#   kit_audit_hook_start "pre-commit"
#   _t0=$(kit_audit_now_ms)
#   if pnpm typecheck; then
#     kit_audit_step "typecheck" "ok" $(( $(kit_audit_now_ms) - _t0 ))
#   else
#     kit_audit_step "typecheck" "fail" $(( $(kit_audit_now_ms) - _t0 ))
#     exit 1
#   fi
#   kit_audit_hook_end "pre-commit" "ok"

_KIT_AUDIT_FILE=".ai-dev-kit/state/kit-audit.jsonl"

kit_audit_now_ms() {
  # GNU date: +%s%3N. BSD date: no %3N, fall back to seconds * 1000.
  local n
  n=$(date -u +%s%3N 2>/dev/null)
  if [ -z "$n" ] || [ "$n" = "$(date -u +%s)N" ] || echo "$n" | grep -q 'N'; then
    n=$(( $(date -u +%s) * 1000 ))
  fi
  printf '%s' "$n"
}

_kit_audit_ts() {
  # ISO 8601 UTC. Try ms precision; fall back to seconds for BSD date.
  local t
  t=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null)
  if [ -z "$t" ] || echo "$t" | grep -q '%3N'; then
    t=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  fi
  printf '%s' "$t"
}

_kit_audit_run_id() {
  if [ -f .ai-dev-kit/state/current-run.json ]; then
    grep -o '"run_id"[[:space:]]*:[[:space:]]*"[^"]*"' .ai-dev-kit/state/current-run.json 2>/dev/null \
      | head -1 \
      | sed -E 's/.*"run_id"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/'
  fi
}

_kit_audit_escape() {
  # JSON-escape: \ " and control chars. Good enough for step names / error lines.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r/\\r/g' | tr -d '\n'
}

# kit_audit_append <kind> <name> [phase] [outcome] [duration_ms] [step] [error]
kit_audit_append() {
  ( # subshell so no local failure affects caller
    mkdir -p .ai-dev-kit/state 2>/dev/null || exit 0
    local kind="$1" name="$2" phase="$3" outcome="$4" duration="$5" step="$6" error="$7"
    local ts rid line
    ts=$(_kit_audit_ts)
    rid=$(_kit_audit_run_id)
    line="{\"ts\":\"${ts}\",\"run_id\":"
    if [ -n "$rid" ]; then line+="\"$(_kit_audit_escape "$rid")\""; else line+="null"; fi
    line+=",\"kind\":\"$(_kit_audit_escape "$kind")\",\"name\":\"$(_kit_audit_escape "$name")\""
    [ -n "$phase" ]    && line+=",\"phase\":\"$(_kit_audit_escape "$phase")\""
    [ -n "$step" ]     && line+=",\"step\":\"$(_kit_audit_escape "$step")\""
    [ -n "$outcome" ]  && line+=",\"outcome\":\"$(_kit_audit_escape "$outcome")\""
    [ -n "$duration" ] && line+=",\"duration_ms\":${duration}"
    [ -n "$error" ]    && line+=",\"error\":\"$(_kit_audit_escape "$error")\""
    line+="}"
    printf '%s\n' "$line" >> "$_KIT_AUDIT_FILE" 2>/dev/null || true
  ) || true
  return 0
}

kit_audit_hook_start() { kit_audit_append "husky_hook" "$1" "start" "" "" "" ""; }
# kit_audit_step <step_name> <outcome> <duration_ms> [error]
kit_audit_step()       { kit_audit_append "husky_hook" "${HUSKY_HOOK_NAME:-hook}" "step" "$2" "$3" "$1" "$4"; }
kit_audit_hook_end()   { kit_audit_append "husky_hook" "$1" "end" "$2" "" "" ""; }

# Helper that wraps a command. Usage: _kit_run_step <step_name> <cmd...>
# Logs outcome + duration. Returns the command's exit code so `set -e` behavior
# in the surrounding hook is preserved.
_kit_run_step() {
  local step="$1"; shift
  local _t0 _rc
  _t0=$(kit_audit_now_ms)
  "$@"
  _rc=$?
  if [ "$_rc" -eq 0 ]; then
    kit_audit_step "$step" "ok" $(( $(kit_audit_now_ms) - _t0 ))
  else
    kit_audit_step "$step" "fail" $(( $(kit_audit_now_ms) - _t0 )) "exit $_rc"
  fi
  return $_rc
}
