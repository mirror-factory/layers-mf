# Multi-Agent Development Setup

How we run a PM agent + 2 dev agents in parallel tmux panes to ship features autonomously.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    tmux session: agents                  │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Pane 0    │  │   Pane 1    │  │   Pane 2    │    │
│  │   PM Agent  │  │   Dev 1     │  │   Dev 2     │    │
│  │  (claude)   │  │  (claude)   │  │  (claude)   │    │
│  │             │  │             │  │             │    │
│  │  Orchestrates│ │  Writes code│  │  Writes code│    │
│  │  creates    │  │  runs tests │  │  runs tests │    │
│  │  issues,    │  │  commits &  │  │  commits &  │    │
│  │  dispatches │  │  pushes     │  │  pushes     │    │
│  │  work, tracks│ │             │  │             │    │
│  │  progress   │  │             │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │             │
│         └────────┬───────┴────────┬───────┘             │
│                  │                │                      │
│           ┌──────┴──────┐  ┌─────┴──────┐              │
│           │ msg-server  │  │   Linear   │              │
│           │ :9876       │  │   MCP      │              │
│           └─────────────┘  └────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the message broker

```bash
node .claude/msg-server.js &
```

This runs an HTTP message queue on port 9876. Agents communicate via channels:
- PM sends to `dev` channel, devs send to `pm` channel
- Messages queue until read, then clear

### 2. Create the tmux session

```bash
tmux new-session -s agents -n work

# Split into 3 panes
tmux split-window -h -t agents:0
tmux split-window -v -t agents:0.1

# Pane layout:
#  ┌──────────┬──────────┐
#  │          │  Dev 1   │
#  │   PM     ├──────────┤
#  │          │  Dev 2   │
#  └──────────┴──────────┘
```

### 3. Start the agents

**Pane 0 — PM Agent (you or Claude):**
```bash
# PM runs interactively or as claude
claude
```

**Pane 1 — Dev Agent 1:**
```bash
tmux send-keys -t agents:0.1 'claude --dangerously-skip-permissions' Enter
```

**Pane 2 — Dev Agent 2:**
```bash
tmux send-keys -t agents:0.2 'claude --dangerously-skip-permissions' Enter
```

### 4. Dispatch work from PM

```bash
# Send a task to Dev 1
tmux send-keys -t agents:0.1 'Work on PROD-158: API documentation page. Read the Linear issue for full scope. Commit with the issue ref in the message. Push when done.' Enter

# Send a task to Dev 2
tmux send-keys -t agents:0.2 'Work on PROD-159: Onboarding flow for new users. Read the Linear issue for full scope. Commit with the issue ref in the message. Push when done.' Enter
```

## Components

### Message Broker (`.claude/msg-server.js`)

Lightweight Node.js HTTP server for inter-agent communication.

```bash
# Send a message
curl -s -H "X-From: pm" -d "your message" http://localhost:9876/send/dev

# Read messages (clears queue)
curl -s http://localhost:9876/read/pm

# Peek at messages (doesn't clear)
curl -s http://localhost:9876/peek/pm

# Check status
curl -s http://localhost:9876/status
```

### PM Agent (`.claude/agents/pm.md`)

Runs on Haiku (fast/cheap). Activates after every `git push` via the post-push hook. Responsibilities:
- Parse commits for Linear refs (`PROD-xxx`, `SERV-xxx`, `COMP-xxx`)
- Post structured comments on matched Linear issues
- Transition issue statuses (In Progress, In Review)
- Update Linear docs (Changelog, Architecture)
- Send ntfy.sh notifications

### Dev Agent (`.claude/agents/dev.md`)

Runs on Sonnet. Has access to code tools + Linear MCP. Protocol:
1. **Start**: Read CLAUDE.md, check PM messages, check Linear for tasks
2. **Work**: Write code, commit with issue refs, push often
3. **End**: Update Linear issues, update Architecture doc, update Changelog

### Post-Push Hook (`.claude/hooks/post-push-pm.sh`)

Async PostToolUse hook. After any `git push`:
1. Extracts SHA range from push output
2. Builds commit data via `git log`
3. Spawns PM agent: `claude -p --agent pm "$PROMPT"`
4. Logs to `.claude/pm-agent.log`

### Config (`.claude/agents/pm-config.json`)

```json
{
  "ntfy_topic": "layers-mf-pm",
  "github_repo": "mirror-factory/layers-mf",
  "github_url": "https://github.com/mirror-factory/layers-mf",
  "team_prefixes": ["PROD", "SERV", "COMP"],
  "statuses": {
    "on_fix": "In Review",
    "on_wip": "In Progress"
  }
}
```

## Workflow

### Typical Sprint Session

1. **PM creates Linear issues** with detailed scope, acceptance criteria, and file hints
2. **PM dispatches** issues to dev agents via tmux send-keys
3. **Dev agents work independently** — reading issues, writing code, running tests, committing
4. **Post-push hook fires** — PM agent auto-comments on Linear, sends ntfy notification
5. **PM monitors progress** — checks test counts, build status, Linear board
6. **PM creates next batch** — when devs finish, new issues are dispatched
7. **Repeat** until sprint goals are met

### Agent Lifecycle Management

Dev agents consume context window as they work. When context drops below ~5%:

```bash
# Gracefully exit the agent
tmux send-keys -t agents:0.1 '/exit' Enter

# Wait for shell prompt, then restart
tmux send-keys -t agents:0.1 'claude --dangerously-skip-permissions' Enter
```

### Handling Plan Mode

If a dev agent gets stuck in plan mode (showing approval dialog):

```bash
# Press Shift+Tab to cycle permission mode
tmux send-keys -t agents:0.1 BTab

# Or clear and resend with a shorter focused message
tmux send-keys -t agents:0.1 C-c
tmux send-keys -t agents:0.1 C-u
tmux send-keys -t agents:0.1 'Just implement PROD-158 directly, no planning needed.' Enter
```

## Notifications

All pushes trigger ntfy.sh notifications to the `layers-mf-pm` topic:

```bash
# Subscribe to notifications
# Open: https://ntfy.sh/layers-mf-pm
# Or install ntfy app and subscribe to "layers-mf-pm"
```

Notification format:
```
Title: Layers push: main (3 commits)
Body:
3 commits pushed to `main`
- abc1234: feat: add search filters (PROD-45)
- def5678: fix: resolve auth bug (PROD-42 → In Review)

Linear updated: PROD-45, PROD-42
```

## Sprint Stats (Session 4)

This setup was used to ship 27 Linear issues in a single session:
- **198 tests** across 26 suites
- **35 commits** pushed
- **PROD-128 → PROD-157** all completed
- **2 dev agents** running in parallel
- **Average issue completion**: ~5 minutes per issue
- **Zero merge conflicts** despite concurrent pushes to same branch

## File Structure

```
.claude/
├── agents/
│   ├── dev.md              # Dev agent definition
│   ├── pm.md               # PM agent definition
│   └── pm-config.json      # PM config (ntfy topic, GitHub URLs, etc.)
├── hooks/
│   ├── post-push-pm.sh     # Async hook: spawns PM agent after git push
│   ├── pre-commit-check.sh # Typecheck + lint before commit
│   └── pre-push-check.sh   # Typecheck + tests before push
├── msg-server.js           # Inter-agent message broker
├── pm-agent.log            # PM agent output log
└── settings.json           # Claude Code settings (hooks config)
```
