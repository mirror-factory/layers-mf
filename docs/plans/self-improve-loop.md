# Self-Improvement Loop

> How Granger improves itself. Run whenever — via `/self-improve` slash command, hook, or cron.

## The Flywheel

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  1. EVAL    │──▶│  2. RESEARCH  │──▶│ 3. DESIGN    │──▶│ 4. IMPLEMENT │
│ expect run  │    │ best practice │    │ update plan  │    │ ship code    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
        ▲                                                          │
        └──────────────────── 5. RE-EVAL ◀────────────────────────┘
```

## Each Step

### 1. EVAL — Run expect tests
- Trigger: manual (`pnpm expect:all`) or post-push hook
- Output: pass/fail per variant, screenshots, failure transcripts
- Logs to: `master-improvement-plan.md` eval log + `master-testing-checklist.md` run history

### 2. RESEARCH — Study the industry
- Every loop pulls fresh context from:
  - **Anthropic**: MCP registry releases, skills patterns, Claude feature changes
  - **OpenAI**: Plugin/GPT Store patterns, structured output updates
  - **Vercel**: AI SDK releases, AI Elements new components, AI Gateway model catalog
  - **Best-in-class products**: v0, Cursor, Cline, Windsurf — how they make AI navigate UIs
- Output: `docs/research/<YYYY-MM-DD>-<topic>.md` with links and quotes
- Updates `master-improvement-plan.md` Research Log section

### 3. DESIGN — Update the plan
- New gaps → new rows in feature matrix
- New UI surfaces → new rows in AI Tool Coverage Matrix
- Reprioritize sprints based on research
- Get Alfonso approval before major pivots

### 4. IMPLEMENT — Ship the fix
- Smallest change that addresses the gap
- Add expect test for the new behavior BEFORE shipping
- Commit and push (`push early, push often`)
- Update changelog + plan status

### 5. RE-EVAL — Close the loop
- Run expect against the new code
- Confirm the gap closed
- Log pass/fail back in eval log
- Spawn next research topic based on remaining gaps

## Triggers

### Manual
```
/self-improve                    # run one full loop
/self-improve --area chat        # focus on one area
/self-improve --research-only    # just step 2
```

### Hook (via `.claude/settings.json`)
After `Stop` on the main agent when any file under `src/` changed:
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": { "tool_names": ["Edit", "Write"] },
        "command": "pnpm expect:changed"
      }
    ]
  }
}
```

### Cron (weekly research digest)
New cron `/api/cron/research-digest` (Sundays 6am):
1. Pulls latest MCP registry additions
2. Pulls AI SDK changelog diffs
3. Pulls Anthropic + OpenAI changelogs
4. Summarizes via Gemini Flash Lite
5. Writes `docs/research/weekly-<date>.md`
6. Adds items to `master-improvement-plan.md` Research Log

## Research Targets (standing list)

| Source | What to watch |
|--------|---------------|
| modelcontextprotocol.io | New MCP servers, auth patterns, health protocols |
| docs.anthropic.com | Claude model updates, skill patterns, tool use |
| openai.com/api/docs | Structured outputs, function calling, plugin manifest evolution |
| sdk.vercel.ai | AI SDK version bumps, new hooks, new providers |
| ai-elements | New UI primitives (bubble menu, canvas, workflow nodes) |
| v0.dev | How v0 exposes generation to AI tools |
| cline.bot / cursor.com | How AI navigates IDE UIs, diff views, terminal |
| smithery.ai | Third-party MCP server patterns |

## Model Selection Research

Every loop should re-evaluate which model is best for each role:

| Role | Current | Alternative to Test | Decision Criteria |
|------|---------|---------------------|-------------------|
| Main chat | Haiku 4.5 | Sonnet 4.5 for complex tool chains | Cost / latency / tool-use accuracy |
| Ambient check | Gemini Flash Lite | Haiku | p50 latency < 300ms |
| Safety review (new) | Gemini Flash | Haiku / GPT-4o-mini | False-positive rate on known-safe MCPs |
| Document edit | Sonnet 4.5 | Opus 4.6 for long docs | Edit precision on eval set |
| Synthesis (nightly cron) | Opus 4.6 | Sonnet 4.5 | Quality of pattern detection |
| Web search summarize | Perplexity (gateway) | GPT-4o + native search | Citation accuracy |

Log benchmarks to `docs/research/model-benchmarks.md`.

## Output Artifacts

Each loop produces:
- Updated `master-improvement-plan.md` (status shifts, new rows)
- Updated `master-testing-checklist.md` (run history)
- New `docs/research/<date>-<topic>.md` file(s)
- Git commit + push (triggers CI)
- (Future) Slack / Discord digest to the team

## Success Metrics

- **Gap closure rate**: how many 🔴 rows move to 🟢 per week
- **Test coverage**: % of UI surfaces with expect tests
- **AI-control coverage**: % of UI surfaces where AI has a tool
- **Research volume**: number of `docs/research/*.md` files per month
- **Eval frequency**: number of expect runs per week
- **Regression catches**: bugs found by expect before users
