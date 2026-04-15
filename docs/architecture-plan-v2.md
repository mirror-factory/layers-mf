# Layers MF / Granger — Architecture Plan v2

**Date:** April 15, 2026
**Version:** 0.9.0 (planned)
**Status:** Implementation Plan

---

## 1. Vercel Workflow Adoption

### Overview
Vercel Workflow is a managed durable execution platform. The `"use workflow"` directive makes any TypeScript function survive crashes, deploys, and timeouts. `DurableAgent` from `@workflow/ai` wraps ToolLoopAgent so each tool call becomes a retryable, checkpointed step with no timeout limits.

### When to use each agent type

| Use case | Agent type | Why |
|---|---|---|
| Interactive chat (user waiting) | `ToolLoopAgent` | Low latency, single invocation |
| Portal chat | `ToolLoopAgent` | Fast tools (highlight, chart, navigate) |
| Scheduled background runs | `DurableAgent` | No timeout, retries, checkpoints |
| Complex multi-tool workflows | `DurableAgent` | Each tool is its own durable step |
| Sandbox creation + execution | `DurableAgent` | Sandbox ops can exceed 60s |

### Implementation
```bash
pnpm add @vercel/workflow @workflow/ai
```

Schedule executor switches from `generateText` to:
```typescript
import { DurableAgent } from "@workflow/ai/agent";

async function executeSchedule(schedule) {
  "use workflow";
  const agent = new DurableAgent({
    model: gateway(schedule.model),
    instructions: buildSystemPrompt(schedule),
    tools: createTools(supabase, orgId, schedule.tool_tier),
    stopWhen: stepCountIs(20),
  });
  return agent.generate({ messages: [{ role: "user", content: schedule.prompt }] });
}
```

### Sources
- https://vercel.com/workflows
- https://vercel.com/docs/workflow
- https://useworkflow.dev/docs/api-reference/workflow-ai/durable-agent
- https://vercel.com/blog/introducing-workflow

---

## 2. Claude Code AI SDK Provider

### Overview
Community provider `ai-sdk-provider-claude-code` enables using Claude via the Claude Agent SDK / Claude Code CLI through the Vercel AI SDK. Uses existing Claude Pro/Max subscription — no separate API key needed.

### Installation
```bash
pnpm add ai-sdk-provider-claude-code @anthropic-ai/claude-agent-sdk
```

Requires Claude Code CLI authenticated:
```bash
curl -fsSL https://claude.ai/install.sh | bash
claude auth login
```

### Configuration (src/lib/ai/config.ts)
```typescript
import { claudeCode } from "ai-sdk-provider-claude-code";

// Dev-only: Claude Code provider (uses CLI auth, no API key)
export const claudeCodeModel = (tier: "opus" | "sonnet" | "haiku") =>
  claudeCode(tier, {
    allowedTools: ["Read", "Write", "Bash", "Glob", "Grep"],
    maxBudgetUsd: 5,
    permissionMode: "acceptEdits",
  });
```

Add to ALLOWED_MODELS for dev mode:
```typescript
if (process.env.NODE_ENV === "development") {
  ALLOWED_MODELS.add("claude-code/opus");
  ALLOWED_MODELS.add("claude-code/sonnet");
  ALLOWED_MODELS.add("claude-code/haiku");
}
```

### Sources
- https://ai-sdk.dev/providers/community-providers/claude-code
- https://github.com/ben-vargas/ai-sdk-provider-claude-code
- https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

---

## 3. Schedule Executor Overhaul

### Current state
- Only `search_context` tool available
- Raw `generateText` (not agentic)
- 60s timeout (Vercel function limit)
- No MCP, no sandbox, no artifacts

### Target state
- Configurable tool tier per schedule
- DurableAgent via Vercel Workflow (no timeout)
- Full tool access for `full` tier

### Tool tier system

| Tier | Tools | Use case |
|---|---|---|
| `minimal` | search_context | Daily digests, queries |
| `standard` | search + write/edit + web + artifacts | Content generation |
| `full` | All 25+ tools + sandbox + MCP | Complex automation |

### Migration: `scheduled_actions` table
```sql
ALTER TABLE scheduled_actions ADD COLUMN tool_tier TEXT DEFAULT 'minimal'
  CHECK (tool_tier IN ('minimal', 'standard', 'full'));
```

---

## 4. Auto-Compaction (Forever-Chats)

### Current state
We already have `createCompactionMiddleware()` in `src/lib/ai/compaction-middleware.ts`. It uses `LanguageModelMiddleware` with `transformParams` to:
1. Estimate total tokens in the prompt
2. If > 80% of context window, compact older messages
3. Keep last 4 turns verbatim
4. Summarize everything else via fast model (gemini-3.1-flash-lite)
5. Replace old messages with summary

### What needs to happen
- Wire the middleware into the main chat route (currently not used)
- Wire into portal chat route
- Full conversation history stays in `chat_messages` table (never deleted)
- Search tool can reach back into full history

### Implementation
In `/api/chat/route.ts`:
```typescript
import { createCompactionMiddleware } from "@/lib/ai/compaction-middleware";
import { wrapLanguageModel } from "ai";

const compaction = createCompactionMiddleware(128_000); // 128K window
const wrappedModel = wrapLanguageModel({ model: gateway(modelId), middleware: compaction });

const agent = new ToolLoopAgent({
  model: wrappedModel,
  // ...
});
```

---

## 5. Library Unification

### Everything becomes searchable

| Content type | Auto/Manual | How it enters library |
|---|---|---|
| Documents, transcripts | Auto (ingestion) | Direct upload / ingest pipeline |
| Artifacts | Auto on create/version | `context_items` row with source_type='artifact' |
| Conversations | Auto after N messages | Summarized `context_items` row, source_type='conversation' |
| MCP content | Manual only | User says "save this" → AI uses store_to_library tool |

### Artifact → Library embedding
When `createArtifact()` or `createVersion()` runs:
```typescript
await supabase.from("context_items").upsert({
  org_id: orgId,
  source_type: "artifact",
  source_id: artifact.id,
  title: artifact.title,
  raw_content: `${artifact.title}\n${artifact.description_short}\n${content.slice(0, 5000)}`,
  metadata: { type: artifact.type, language: artifact.language, version: artifact.current_version },
}, { onConflict: "org_id,source_type,source_id" });
// Then generate embedding via embedding pipeline
```

### Conversation → Library embedding
After every ~20 messages:
```typescript
const summary = await generateText({
  model: gateway(TASK_MODELS.compaction),
  prompt: `Summarize this conversation: topics, decisions, artifacts created...\n${transcript}`,
});
await supabase.from("context_items").upsert({
  org_id: orgId,
  source_type: "conversation",
  source_id: conversation.id,
  title: conversation.title,
  raw_content: summary.text,
}, { onConflict: "org_id,source_type,source_id" });
```

### Library sections
- **My Items** — content you created (filter by type: docs, artifacts, chats)
- **Shared with Me** — content others shared with you
- **Org Library** — content shared org-wide

### Auto-suggestion on ingest
Every item entering the library gets AI-suggested:
- Tags (inferred from content)
- Category (matched to existing categories)
- Related items (semantic similarity)
User can accept, modify, or dismiss.

### Detail page for every item
Every item (chat, artifact, doc, PDF) gets a detail page showing:
- Full content preview
- Metadata (created by, created at, last modified, version)
- Embedding tags (editable)
- Interaction history (who opened, edited, shared)
- Related items
- Sharing controls
- Version history (for artifacts)

---

## 6. Artifact Interaction Tracking

### Migration: `artifact_interactions`
```sql
CREATE TABLE artifact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'created', 'viewed', 'edited', 'shared', 'opened_by_recipient',
    'sandbox_executed', 'ai_read', 'ai_modified', 'forked',
    'restored', 'deleted', 'tagged', 'commented'
  )),
  metadata JSONB DEFAULT '{}',
  chat_context TEXT,
  conversation_id UUID,
  version_number INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_artifact_interactions_artifact ON artifact_interactions(artifact_id);
CREATE INDEX idx_artifact_interactions_user ON artifact_interactions(user_id);
CREATE INDEX idx_artifact_interactions_created ON artifact_interactions(created_at);
```

### "Why" extraction
When edit_code tool fires inside a conversation:
1. Get the user's last message before the tool call
2. Store as `chat_context` on the interaction row
3. AI can later reference: "Kyle edited v3 — 'making it blue per client request'"

### Wiring into tool paths
- `write_code` → log `created`
- `edit_code` → log `edited` with version_from/to + chat_context
- `artifact_get` → log `ai_read`
- `run_code` → log `sandbox_executed` with exit_code
- `artifact_delete` → log `deleted`
- GET /api/artifacts/[id] → log `viewed`
- Share action → log `shared`

---

## 7. Chat Collaboration & Sharing

### Migration: `conversation_members`
```sql
CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'participant',
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID,
  can_see_history_before_join BOOLEAN DEFAULT true,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
```

### @ mention system
- `@Kyle` in message → add to conversation_members + notify
- `@document-name` → inject document content into AI context
- Both use same `@` picker UI with People/Library tabs

### Participants modal
- Tap chat header → see all members
- Owner can add/remove, change roles (owner/participant/viewer)
- Each member shows: name, when added, last active

### Turn-based (not real-time)
- User A sends → notification to User B
- User B opens → responds → notification to User A
- Every message has user_id for attribution

---

## 8. Sharing & Permissions Model

### `content_shares` table
```sql
CREATE TABLE content_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  shared_with_user_id UUID,
  scope TEXT DEFAULT 'user',
  permission TEXT DEFAULT 'view',
  shared_by UUID NOT NULL,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Permission levels
| Level | Can do |
|---|---|
| `view` | Read only |
| `edit` | Read + modify |
| `admin` | Read + modify + share + delete |

### Google Drive-inspired library view
- My Items / Shared with Me / Org Library
- Filter by type (docs, artifacts, chats, collections)
- Sort by date, name, last modified

---

## 9. Org Setup & Invitations

### Current state
- `organizations` table with org_id
- `org_members`: (org_id, user_id, role) — owner/admin/member
- `org_invitations`: email + role + status + expires_at
- Auto-created org on signup via trigger
- Invitation flow: owner invites email → Supabase auth invite → user signs up → auto-joins org

### Roles
| Role | Permissions |
|---|---|
| `owner` | Everything + billing + delete org |
| `admin` | Manage members + all content + settings |
| `member` | Own content + shared content + chat |

### Front-end settings page
- `/settings` → Team tab → list members + roles
- Invite button → email + role picker
- Pending invitations list
- Remove member / change role actions

---

## 10. Ambient AI Mode

### How it works
In collaborative chats (2+ members), AI can proactively suggest info:
1. Lightweight check after each human message (fast model)
2. If relevant info found → shows suggestion card
3. Accept / Dismiss / Tell me more buttons
4. All interactions tracked (who tapped what)

### Cost control
- Only in collaborative chats
- Fast/cheap model for the check
- Max 1 check per 5 messages
- Toggleable per conversation

---

## 11. Universal ID & Reference System

### Every item has a stable ID
- Artifacts: `artifact.id` (UUID)
- Conversations: `conversation.id` (UUID)
- Context items: `context_item.id` (UUID)
- Users: `user.id` (UUID)

### @ references in chat
When a message references an item via `@`:
```json
{
  "type": "context-reference",
  "resource_type": "artifact",
  "resource_id": "uuid-here",
  "display_name": "Calculator App"
}
```
Front-end renders as a clickable chip. AI gets the full content injected.

---

## 12. Branding Fix

### Issue
Landing page / home hero shows BlueWave branding (portal demo assets leaked into main app).

### Fix
- Check `src/components/home-hero.tsx` and landing page for hardcoded BlueWave references
- Ensure NeuralMorph orbit animation uses Granger/Layers branding
- Portal-specific assets stay in `/portal/` route only

---

## 13. Notification → Chat Navigation

### Issue
Schedule completion notifications don't navigate to the chat and have no visual indicator.

### Fix
- Notification items with `conversation_id` → show chat bubble icon
- Click handler: `router.push(\`/chat/\${conversationId}\`)`
- Notification metadata already has `link` field — ensure it's set to `/chat?id={conversationId}`
