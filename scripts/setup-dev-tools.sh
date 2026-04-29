#!/bin/bash
# Optional dev-tools installer.
#
# Installs the Vercel Labs tools that the Evaluator subagent uses:
#   - agent-browser (browser-automation CLI with accessibility refs)
#   - dev3000 / d3k (unified dev-time log feed for Claude Code)
#
# Both are optional: the Evaluator falls back to Playwright MCP + raw stdout
# when they aren't installed. Run this once per developer machine.
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${CYAN}Installing Evaluator-backend dev tools${NC}\n"

# agent-browser ----------------------------------------------------------
if command -v agent-browser &>/dev/null; then
  echo -e "  ${GREEN}agent-browser already installed${NC} ($(agent-browser --version 2>/dev/null || echo 'unknown'))"
else
  echo -e "  Installing ${CYAN}agent-browser${NC}..."
  npm install -g agent-browser
  echo -e "  Downloading Chrome for Testing..."
  agent-browser install --with-deps || agent-browser install
fi

# Register the agent-browser skill for Claude Code sessions in this project.
# Uses Vercel's skills CLI if available, otherwise prints a manual hint.
if [ -d ".claude" ]; then
  if command -v skills &>/dev/null; then
    skills add vercel-labs/agent-browser 2>/dev/null || true
  else
    echo -e "  ${YELLOW}Install the skills CLI to auto-register the agent-browser skill:${NC}"
    echo -e "  ${CYAN}npm install -g skills${NC}"
    echo -e "  Then: ${CYAN}skills add vercel-labs/agent-browser${NC}"
  fi
fi

# dev3000 ----------------------------------------------------------------
if command -v d3k &>/dev/null; then
  echo -e "  ${GREEN}dev3000 already installed${NC} ($(d3k --version 2>/dev/null || echo 'unknown'))"
else
  echo -e "  Installing ${CYAN}dev3000${NC}..."
  if command -v bun &>/dev/null; then
    bun install -g dev3000
  else
    npm install -g dev3000
  fi
fi

echo -e "\n${GREEN}Done.${NC}"

# Optional: register MCP servers with Claude Code CLI if available.
# The project's .mcp.json is auto-loaded by Claude Code anyway -- this
# step adds them to the user-level config so they're available across
# projects. Safe to skip.
if command -v claude &>/dev/null && [ -f ".mcp.json" ]; then
  echo -e "\n${CYAN}Registering MCP servers with Claude Code (user-scoped)...${NC}"
  if ! claude mcp list 2>/dev/null | grep -q "context7"; then
    claude mcp add context7 -- npx -y @upstash/context7-mcp 2>/dev/null && \
      echo -e "  ${GREEN}+${NC} context7" || true
  fi
  if ! claude mcp list 2>/dev/null | grep -q "firecrawl"; then
    claude mcp add firecrawl --env "FIRECRAWL_API_KEY=\${FIRECRAWL_API_KEY}" -- npx -y firecrawl-mcp 2>/dev/null && \
      echo -e "  ${GREEN}+${NC} firecrawl" || true
  fi
  if ! claude mcp list 2>/dev/null | grep -q "playwright"; then
    claude mcp add playwright -- npx -y @modelcontextprotocol/server-playwright 2>/dev/null && \
      echo -e "  ${GREEN}+${NC} playwright" || true
  fi
fi
echo -e ""
echo -e "Usage:"
echo -e "  ${CYAN}d3k --with-agent claude${NC}   start dev server + Claude Code in tmux, unified log at ~/.d3k/<project>/d3k.log"
echo -e "  ${CYAN}agent-browser open <url>${NC}  drive a browser; snapshot/click/fill via @eN refs"
echo -e ""
echo -e "The Evaluator subagent uses both automatically when available."
echo -e ""
