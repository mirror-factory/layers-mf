# API Reference

Last updated: 2026-04-06

All API routes live in `src/app/api/`. Unless noted otherwise, auth is via Supabase session cookie (`getUser()`). Org context is resolved by looking up `org_members` for the authenticated user.

---

## Table of Contents

1. [Chat](#chat)
2. [Conversations](#conversations)
3. [Context Library](#context-library)
4. [Collections](#collections)
5. [Tags](#tags)
6. [Artifacts](#artifacts)
7. [Sharing](#sharing)
8. [Scheduling](#scheduling)
9. [Skills](#skills)
10. [MCP Servers](#mcp-servers)
11. [Integrations](#integrations)
12. [Notifications](#notifications)
13. [Inbox](#inbox)
14. [Analytics](#analytics)
15. [Billing](#billing)
16. [Team & Org](#team--org)
17. [Settings](#settings)
18. [Ditto (Personalization)](#ditto-personalization)
19. [Canvases](#canvases)
20. [Saved Searches](#saved-searches)
21. [Documents](#documents)
22. [Edit Proposals](#edit-proposals)
23. [Approval Queue](#approval-queue)
24. [Rules](#rules)
25. [Priority Docs](#priority-docs)
26. [Sessions](#sessions)
27. [Sandbox](#sandbox)
28. [Admin](#admin)
29. [Cron Jobs](#cron-jobs)
30. [Webhooks](#webhooks)
31. [Other](#other)

---

## Chat

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Yes | Agentic chat via ToolLoopAgent. Streams UIMessage parts. Body: `{messages, model?, conversationId?, sessionId?, selectedSkill?, contextItemIds?}` |
| GET | `/api/chat/history` | Yes | Fetch chat messages. Query: `?session_id=` or `?conversation_id=`. Returns UIMessage array. |
| GET | `/api/chat/context-stats` | Yes | Token counts for system prompt, rules, tools. Query: `?conversationId=&model=` |
| POST | `/api/chat/branch` | Yes | Branch conversation at a message index. Body: `{conversationId, messageIndex}`. Returns new conversationId. |
| POST | `/api/chat/feedback` | Yes | Submit feedback on a message. Body: `{messageId, feedback: "positive"|"negative", reason?}`. Logs to audit_log. |
| POST | `/api/chat/share` | Yes | Share conversation with team members. Body: `{conversationId, userIds[]}`. |
| GET | `/api/chat/share` | Yes | List who a conversation is shared with. Query: `?conversation_id=`. |
| POST | `/api/chat/share-link` | Yes | Create a public share link for a conversation. Body: `{conversationId}`. |
| DELETE | `/api/chat/share-link` | Yes | Revoke a public share link. Body: `{shareId}`. |
| POST | `/api/chat/session/[id]` | Yes | Session-scoped agentic chat. Same as /api/chat but scoped to a session. |

---

## Conversations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/conversations` | Yes | List user's conversations, ordered by updated_at DESC. Returns `[{id, title, created_at, updated_at}]`. |
| POST | `/api/conversations` | Yes | Create new conversation. Body: `{title?}`. Returns conversation object (201). |
| GET | `/api/conversations/[id]` | Yes | Get single conversation by ID. |
| DELETE | `/api/conversations/[id]` | Yes | Delete conversation and all its messages (204). |

---

## Context Library

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/context/[id]` | Yes | Get single context item with full details. |
| PATCH | `/api/context/[id]` | Yes | Update context item fields (title, content, description, etc.). Creates document_version for audit. |
| DELETE | `/api/context/[id]` | Yes | Delete single context item. |
| DELETE | `/api/context/bulk` | Yes | Bulk delete context items. Body: `{ids: string[]}`. Returns `{deleted: number}`. |
| POST | `/api/context/search` | Yes | Hybrid search (vector + BM25). Body: `{query, limit?, sourceType?, contentType?, dateFrom?, dateTo?}`. |
| POST | `/api/context/process` | Yes | Trigger AI processing for a context item via Inngest. Body: `{contextItemId}`. Returns 202. |
| POST | `/api/context/classify` | Yes | AI-classify a context item. Body: `{contextItemId}`. |
| GET | `/api/context/export` | Yes | Export all items as JSON or CSV. Query: `?format=json|csv`. |
| POST | `/api/context/export` | Yes | Export specific items, session, or search results. Body: `{items[]?, sessionId?, query?, format?: "markdown"|"json", limit?}`. |
| GET | `/api/context/[id]/annotations` | Yes | Get user overlay fields (user_title, user_notes, user_tags, trust_weight). |
| PATCH | `/api/context/[id]/annotations` | Yes | Update user overlay fields. Body: `{user_title?, user_notes?, user_tags?, trust_weight?}`. |
| GET | `/api/context/[id]/doc-versions` | Yes | List document edit versions for a context item. Returns `{versions[], total}`. |
| GET | `/api/context/[id]/versions/[versionNumber]` | Yes | Get specific context_item_version by version number. |
| GET | `/api/context/[id]/versions` | Yes | List all context_item_versions for an item. |
| POST | `/api/context/[id]/propose-edit` | Yes | Create an edit proposal for majority approval. Body: `{title?, content, change_summary?}`. |
| GET | `/api/context/[id]/tags` | Yes | List tags on a context item. |
| POST | `/api/context/[id]/tags` | Yes | Add tag to context item. Body: `{tagId}` or `{name}` (auto-create). |
| DELETE | `/api/context/[id]/tags` | Yes | Remove tag from context item. Body: `{tagId}`. |
| POST | `/api/context/[id]/archive` | Yes | Archive a context item (sets archived_at). |
| DELETE | `/api/context/[id]/archive` | Yes | Unarchive a context item (clears archived_at). |
| POST | `/api/context/[id]/pin` | Yes | Pin a context item for quick access. |
| DELETE | `/api/context/[id]/pin` | Yes | Unpin a context item. |

---

## Collections

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/collections` | Yes | List collections for the org. Query: `?parent_id=` for nested. |
| POST | `/api/collections` | Yes | Create collection. Body: `{name, description?, parent_id?, icon?, color?, is_smart?, smart_filter?}`. |
| GET | `/api/collections/[id]` | Yes | Get collection with item count. |
| PATCH | `/api/collections/[id]` | Yes | Update collection. Body: `{name?, description?, icon?, color?, sort_order?}`. |
| DELETE | `/api/collections/[id]` | Yes | Delete collection (cascades to collection_items). |
| POST | `/api/collections/[id]/items` | Yes | Add item to collection. Body: `{contextItemId, sort_order?}`. |
| DELETE | `/api/collections/[id]/items` | Yes | Remove item from collection. Body: `{contextItemId}`. |

---

## Tags

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tags` | Yes | List org tags. Query: `?sort=usage|name`. |
| POST | `/api/tags` | Yes | Create tag. Body: `{name, color?, tag_type?}`. |
| PATCH | `/api/tags/[id]` | Yes | Update tag. Body: `{name?, color?}`. |
| DELETE | `/api/tags/[id]` | Yes | Delete tag (cascades to item_tags). |
| POST | `/api/tags/[id]` | Yes | Bulk-apply tag to multiple items. Body: `{contextItemIds[]}`. |

---

## Artifacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/artifacts` | Yes | List artifacts for the org. Query: `?conversationId=`. |
| GET | `/api/artifacts/[id]` | Yes | Get single artifact with versions. |
| PATCH | `/api/artifacts/[id]` | Yes | Update artifact metadata or content. |
| DELETE | `/api/artifacts/[id]` | Yes | Delete artifact. |
| GET | `/api/artifacts/[id]/versions` | Yes | List artifact versions. |
| POST | `/api/artifacts/[id]/versions` | Yes | Create new artifact version. Body: `{content, title?}`. |
| GET | `/api/artifacts/[id]/versions/[versionNumber]` | Yes | Get specific artifact version. |
| DELETE | `/api/artifacts/[id]/versions/[versionNumber]` | Yes | Delete specific artifact version. |

---

## Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sharing` | Yes | List shares involving the user (as sharer or recipient). Query: `?contentType=&contentId=`. |
| POST | `/api/sharing` | Yes | Share content with user. Body: `{contentId, contentType, sharedWith, permission?}`. |
| DELETE | `/api/sharing` | Yes | Remove share. Body: `{shareId}`. |
| DELETE | `/api/sharing/[id]` | Yes | Delete specific share. |
| PATCH | `/api/sharing/[id]` | Yes | Update share permission. Body: `{permission}`. |
| POST | `/api/share-link` | Yes | Create public share link. Body: `{resourceType, resourceId, password?, expiresAt?}`. |
| DELETE | `/api/share-link` | Yes | Revoke public share link. Body: `{shareId}`. |
| GET | `/api/share-link/[token]` | No | Access publicly shared content by token. Returns resource data if active. |

---

## Scheduling

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/schedules` | Yes | List scheduled actions for the org. |
| POST | `/api/schedules` | Yes | Create schedule. Body: `{name, description?, action_type, target_service?, payload, schedule, max_runs?}`. |
| PATCH | `/api/schedules/[id]` | Yes | Update schedule status. Body: `{status: "active"|"paused"}`. |
| DELETE | `/api/schedules/[id]` | Yes | Delete schedule. |
| POST | `/api/schedules/execute` | Yes | Manually execute a schedule. Body: `{scheduleId}`. |

---

## Skills

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/skills` | Yes | List org skills (auto-seeds builtins on first call). Returns `{skills[]}`. |
| POST | `/api/skills` | Yes | Create custom skill. Body: `{name, description, slug?, systemPrompt?, tools?, config?, referenceFiles?, slashCommand?, category?, icon?}`. |
| PATCH | `/api/skills/[id]` | Yes | Update skill. Body: `{isActive?, name?, description?, systemPrompt?, tools?, referenceFiles?, slashCommand?, icon?, category?}`. |
| DELETE | `/api/skills/[id]` | Yes | Delete custom skill (403 for builtins). |
| GET | `/api/skills/search` | No | Search skills.sh registry. Query: `?q=`. Proxy for CORS. |
| POST | `/api/skills/seed` | Yes | Upsert builtin skills for the org. |
| POST | `/api/skills/upload` | Yes | Upload a skill package. |

---

## MCP Servers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mcp-servers` | Yes | List MCP servers for the org. Returns `{servers[]}`. |
| POST | `/api/mcp-servers` | Yes | Add MCP server. Tests connection first (unless OAuth). Body: `{name, url, apiKey?, authType?, transportType?, oauthAuthorizeUrl?, oauthTokenUrl?, oauthClientId?, oauthClientSecret?}`. |
| PATCH | `/api/mcp-servers/[id]` | Yes | Update server (toggle active, rename, update OAuth config). |
| DELETE | `/api/mcp-servers/[id]` | Yes | Remove MCP server. |
| POST | `/api/mcp-servers/test` | Yes | Test MCP server connection. Body: `{url, apiKey?, transportType?}`. |
| POST | `/api/mcp/discover` | Yes | Discover MCP server tools. Body: `{url}`. |
| GET | `/api/mcp/registry` | Yes | Browse MCP server registry. Query: `?q=&category=`. |
| GET | `/api/mcp/oauth/callback` | No | OAuth callback for MCP server authentication. Query: `?code=&state=`. |

---

## Integrations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/integrations` | Yes | List org integrations (Nango connections). |
| DELETE | `/api/integrations/[id]` | Yes | Remove integration. |
| GET | `/api/integrations/[id]/config` | Yes | Get integration sync config. |
| PATCH | `/api/integrations/[id]/config` | Yes | Update integration sync config. Body: `{syncConfig}`. |
| POST | `/api/integrations/connect-session` | Yes | Create Nango connect session for OAuth flow. |
| POST | `/api/integrations/save-connection` | Yes | Save a new Nango connection after OAuth. Body: `{provider, connectionId}`. |
| POST | `/api/integrations/sync` | Yes | Full sync: fetch from all connected providers, extract, embed. Body: `{provider?}`. |
| POST | `/api/integrations/sync-trigger` | Yes | Trigger background sync. Body: `{provider?}`. |
| POST | `/api/integrations/google-drive/sync` | Yes | Sync Google Drive specifically. |
| POST | `/api/integrations/linear/sync` | Yes | Sync Linear specifically. |
| POST | `/api/integrations/discord/sync` | Yes | Sync Discord specifically. |
| GET | `/api/integrations/drive/list` | Yes | List Google Drive files. Query: `?folderId=`. |
| POST | `/api/integrations/import` | Yes | Import specific items from an integration. Body: `{provider, items[]}`. |
| GET | `/api/integrations/import/[jobId]` | Yes | Check import job status. |

---

## Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Yes | List user notifications. Query: `?unread_only=true&limit=`. |
| POST | `/api/notifications` | Yes | Create notification (server-side). Body: `{userId, type, title, body?, link?, metadata?}`. |
| PATCH | `/api/notifications/[id]` | Yes | Mark notification as read. Body: `{is_read: true}`. |
| DELETE | `/api/notifications/[id]` | Yes | Delete notification. |
| POST | `/api/notifications/read-all` | Yes | Mark all notifications as read. |
| GET | `/api/notifications/poll` | Yes | Poll for recent events (schedule completions, approvals, inbox items, system chats). Returns `{events[], approvals[], inbox[], systemChats[]}`. |
| POST | `/api/notifications/register` | Yes | Register device token for push notifications. Body: `{token, platform: "ios"|"android"|"web"}`. |

---

## Inbox

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/inbox/generate` | Yes | Trigger inbox item generation via AI. Body: `{contextItemId?}`. |
| GET | `/api/inbox/generate` | Yes | List recent inbox items. |
| GET | `/api/inbox/digest-preview` | Yes | Preview daily digest content. |

---

## Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/costs` | Yes (admin) | AI cost analytics. Query: `?startDate=&endDate=&groupBy=model|user|date`. Requires owner/admin role. |
| GET | `/api/analytics/content-health` | Yes | Content pipeline health metrics via `get_context_health()` RPC. |
| GET | `/api/analytics/sandbox-costs` | Yes | Sandbox compute cost analytics. Query: `?startDate=&endDate=`. |
| GET | `/api/analytics/webhook-health` | Yes | Webhook processing health metrics. |

---

## Billing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/credits` | Yes | Get org credit balance. Returns `{credits, hasStripeCustomer, orgId}`. |
| POST | `/api/billing/checkout` | Yes | Create Stripe checkout session for credit purchase. Body: `{packageId}`. |
| GET | `/api/billing/subscription` | Yes | Get current subscription details. |
| POST | `/api/billing/subscription` | Yes | Create or update subscription. Body: `{priceId}`. |
| DELETE | `/api/billing/subscription` | Yes | Cancel subscription. |
| GET | `/api/billing/usage` | Yes | Get token usage summary. |

---

## Team & Org

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/team/members` | Yes | List org members with roles and profiles. |
| PATCH | `/api/team/members` | Yes | Update member role. Body: `{userId, role}`. Requires owner/admin. |
| DELETE | `/api/team/members` | Yes | Remove member from org. Body: `{userId}`. Requires owner/admin. |
| GET | `/api/team/invite` | Yes | List pending invitations. |
| POST | `/api/team/invite` | Yes | Send invitation. Body: `{email, role?}`. Requires owner/admin. |
| DELETE | `/api/team/invite/[id]` | Yes | Revoke invitation. |
| GET | `/api/team/profile` | Yes | Get current user's profile metadata. |
| PATCH | `/api/team/profile` | Yes | Update profile metadata. Body: `{displayName?, avatarUrl?}`. |
| GET | `/api/org/stats` | Yes | Org-level statistics (member count, item count, etc.). |

---

## Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings/org` | Yes | Get org settings (name, slug, features). |
| PATCH | `/api/settings/org` | Yes | Update org settings. Body: `{name?, slug?}`. Requires owner/admin. |
| DELETE | `/api/settings/org` | Yes | Delete organization. Requires owner. |
| POST | `/api/settings/partner` | Yes | Save partner settings (AI gateway key, default model, etc.). Body: `{aiGatewayKey?, defaultModel?, discordUserId?}`. |
| GET | `/api/settings/permissions` | Yes | Get tool permissions (per-service read/write access). |
| POST | `/api/settings/permissions` | Yes | Update tool permissions. Body: `{linear?: {read, write}, gmail?: {read, write}, ...}`. |
| GET | `/api/settings/notifications` | Yes | Get notification preferences. |
| PATCH | `/api/settings/notifications` | Yes | Update notification preferences. Body: `{digest_enabled?, digest_time?, email_on_mention?, ...}`. |
| GET | `/api/settings/source-weights` | Yes | Get per-source search weight overrides. |
| PATCH | `/api/settings/source-weights` | Yes | Update source weights. Body: `{weights: {source_type: number}}`. |
| POST | `/api/settings/credentials` | Yes | Store encrypted credential. Body: `{provider, token}`. |
| GET | `/api/settings/api-keys` | Yes | List API keys. |
| POST | `/api/settings/api-keys` | Yes | Create API key. Body: `{name}`. |
| DELETE | `/api/settings/api-keys` | Yes | Revoke API key. Body: `{keyId}`. |

---

## Ditto (Personalization)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ditto/profile` | Yes | Get user's Ditto personalization profile. |
| PATCH | `/api/ditto/profile` | Yes | Update profile preferences. Body: `{interests?, preferred_sources?, communication_style?, detail_level?, priority_topics?, working_hours?}`. |
| POST | `/api/ditto/profile/generate` | Yes | Regenerate profile from interaction history. |
| GET | `/api/ditto/suggestions` | Yes | Get personalized content suggestions. |

---

## Canvases

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/canvases` | Yes | List org canvases. |
| POST | `/api/canvases` | Yes | Create canvas. Body: `{name, description?}`. |
| GET | `/api/canvases/[id]` | Yes | Get canvas with items and connections. |
| PATCH | `/api/canvases/[id]` | Yes | Update canvas (name, viewport, settings). |
| DELETE | `/api/canvases/[id]` | Yes | Delete canvas. |
| POST | `/api/canvases/[id]/items` | Yes | Add item to canvas. Body: `{context_item_id?, item_type?, x, y, width?, height?, content?, color?}`. |
| PATCH | `/api/canvases/[id]/items` | Yes | Update canvas item position/style. Body: `{itemId, x?, y?, width?, height?, color?, style?, content?}`. |
| DELETE | `/api/canvases/[id]/items` | Yes | Remove item from canvas. Body: `{itemId}`. |
| POST | `/api/canvases/[id]/connections` | Yes | Create connection between items. Body: `{from_item_id, to_item_id, label?}`. |
| DELETE | `/api/canvases/[id]/connections` | Yes | Remove connection. Body: `{connectionId}`. |

---

## Saved Searches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/searches` | Yes | List user's saved searches + org shared searches. |
| POST | `/api/searches` | Yes | Save a search. Body: `{name, query, filters?, is_shared?}`. |
| DELETE | `/api/searches/[id]` | Yes | Delete saved search. |

---

## Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/documents/[id]` | Yes | Auto-save document content. Body: `{content}`. Updates raw_content on context_items. |
| POST | `/api/documents/inline-edit` | Yes | AI-assisted inline edit. Body: `{documentId, instruction, selection?}`. |

---

## Edit Proposals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/edit-proposals` | Yes | List edit proposals. Query: `?status=pending|approved|rejected|all`. |
| POST | `/api/edit-proposals/[id]/vote` | Yes | Vote on a proposal. Body: `{approved: boolean}`. Auto-applies if threshold met. |

---

## Approval Queue

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/approval` | Yes | List approval queue items (newest first, limit 50). |
| POST | `/api/approval/[id]` | Yes | Approve or reject. Body: `{action: "approve"|"reject"}`. Executes action if approved. |

---

## Rules

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/rules` | Yes | List rules. Query: `?scope=personal|org`. |
| POST | `/api/rules` | Yes | Create rule. Body: `{text, priority?, scope?}`. |
| PATCH | `/api/rules` | Yes | Update rule. Body: `{id, text?, is_active?, priority?}`. |
| DELETE | `/api/rules` | Yes | Delete rule. Body: `{id}`. |

---

## Priority Docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/priority-docs` | Yes | List priority documents ordered by weight. |
| POST | `/api/priority-docs` | Yes | Create priority doc. Body: `{filename, content, weight?}`. |
| PATCH | `/api/priority-docs` | Yes | Update priority doc. Body: `{id, filename?, content?, weight?, is_active?}`. |
| DELETE | `/api/priority-docs` | Yes | Delete priority doc. Body: `{id}`. |

---

## Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sessions` | Yes | List org sessions. |
| POST | `/api/sessions` | Yes | Create session. Body: `{name, goal}`. |
| GET | `/api/sessions/[id]` | Yes | Get session details. |
| PATCH | `/api/sessions/[id]` | Yes | Update session (name, goal, status, agent_config). |
| POST | `/api/sessions/[id]/context` | Yes | Link context items to session. Body: `{contextItemIds[]}`. |
| DELETE | `/api/sessions/[id]/context` | Yes | Unlink context items from session. Body: `{contextItemIds[]}`. |
| GET | `/api/sessions/[id]/members` | Yes | List session members. |
| POST | `/api/sessions/[id]/members` | Yes | Add member to session. Body: `{userId}`. |
| GET | `/api/sessions/[id]/insights` | Yes | List session insights. |
| PATCH | `/api/sessions/[id]/insights` | Yes | Dismiss or pin insight. Body: `{insightId, status}`. |

---

## Sandbox

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sandbox/[artifactId]` | Yes | Get sandbox state for artifact. |
| POST | `/api/sandbox/[artifactId]` | Yes | Execute code in sandbox. Body: `{code?, files?}`. |
| DELETE | `/api/sandbox/[artifactId]` | Yes | Destroy sandbox. |
| POST | `/api/sandbox/restart` | Yes | Restart sandbox. Body: `{artifactId}`. |
| GET | `/api/sandbox/status` | Yes | Get sandbox health status. |
| POST | `/api/sandbox/demo` | Yes | Create demo sandbox. |
| GET | `/api/sandbox/demo` | Yes | Get demo sandbox status. |
| DELETE | `/api/sandbox/demo` | Yes | Delete demo sandbox. |

---

## Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | Super-admin | Platform-wide statistics. Requires super-admin email. |
| GET | `/api/admin/config` | Super-admin | Get platform config (model pricing, credit config). |
| PATCH | `/api/admin/config` | Super-admin | Update platform config. Body: `{key, value}`. |

---

## Cron Jobs

All cron endpoints verify a `CRON_SECRET` header or similar auth mechanism.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cron/ingest` | Cron | Process pending context items (extract, embed). |
| POST | `/api/cron/ingest` | Cron | Same as GET, POST variant. |
| GET | `/api/cron/digest` | Cron | Generate and send daily digests to users. |
| POST | `/api/cron/synthesis` | Cron | Run cross-source synthesis for insights. |
| GET | `/api/cron/synthesis` | Cron | Same, GET variant. |
| GET | `/api/cron/execute-schedules` | Cron | Execute due scheduled actions. |
| GET | `/api/cron/linear-check` | Cron | Check Linear for updates and sync. |
| POST | `/api/cron/linear-check` | Cron | Manual trigger for Linear sync. |
| GET | `/api/cron/credit-reset` | Cron | Reset free-tier credits monthly. |
| GET | `/api/cron/drive-watch-renewal` | Cron | Renew Google Drive watch channels. |
| GET/POST | `/api/cron/discord-alerts` | Cron | Process Discord alert notifications. |
| GET/POST | `/api/cron/classify` | Cron | Auto-classify unclassified context items. |

---

## Webhooks

All webhook endpoints verify provider-specific signatures.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/stripe` | Stripe sig | Handle Stripe events (checkout, subscription changes). |
| POST | `/api/webhooks/linear` | Linear sig | Handle Linear issue/project updates. |
| POST | `/api/webhooks/nango` | Nango sig | Handle Nango connection events. |
| POST | `/api/webhooks/google-drive` | Google sig | Handle Google Drive change notifications. |
| POST | `/api/webhooks/discord` | Discord sig | Handle Discord events. |
| POST | `/api/webhooks/ingest` | API key | Generic ingest webhook for external content. Body: `{orgId, items[]}`. |

---

## Other

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check endpoint. Returns `{status: "ok"}`. |
| POST | `/api/interactions` | Yes | Track user interaction. Body: `{interaction_type, resource_type?, resource_id?, query?, metadata?}`. |
| GET | `/api/interactions` | Yes | List recent user interactions. |
| GET | `/api/audit` | Yes | Query audit log. Query: `?action=&resource_type=&limit=`. |
| GET | `/api/actions` | Yes | List action items from context entities. Query: `?status=&source_type=&limit=&offset=`. |
| PATCH | `/api/actions` | Yes | Update action item status. Body: `{contextItemId, actionIndex, status}`. |
| GET | `/api/agents/templates` | Yes | List agent configuration templates. |
| POST | `/api/agents/run` | Yes | Trigger standalone agent run. Body: `{query, model?, tools?}`. |
| POST | `/api/generate` | Yes | General-purpose AI generation. Body: `{prompt, model?, maxTokens?}`. |
| POST | `/api/scaffolding/apply` | Yes | Apply project scaffolding template. Body: `{template, config}`. |
| POST | `/api/inngest` | Inngest | Inngest event handler endpoint. |
| GET | `/api/auth/google/start` | Yes | Start Google OAuth flow. |
| GET | `/api/auth/google/callback` | No | Google OAuth callback handler. |
| POST | `/api/discord/register` | Yes | Register Discord bot commands. |
| POST | `/api/discord/interactions` | Discord | Handle Discord interaction callbacks. |
| GET | `/api/discord/interactions` | No | Discord interaction verification. |
| POST | `/api/ingest/upload` | Yes | Upload file for ingestion. Multipart form data. |
| GET | `/api/link-preview` | Yes | Fetch link preview metadata. Query: `?url=`. |
| POST | `/api/chat-sdk/webhook` | API key | Chat SDK webhook for external integrations. |
| GET | `/api/tools/registry` | Yes | List all available tools with schemas. |
