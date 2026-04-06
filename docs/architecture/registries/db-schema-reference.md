# Database Schema Reference

Last updated: 2026-04-06

Layers uses Supabase (PostgreSQL) with pgvector and pg_trgm extensions. All tables use UUID primary keys with `gen_random_uuid()` defaults. Row Level Security (RLS) is enabled on every user-facing table.

---

## Table of Contents

1. [Core: Organizations & Members](#organizations)
2. [Context: Items, Chunks, Versions](#context-items)
3. [Content Organization: Collections, Tags, Pins](#collections)
4. [Chat: Conversations & Messages](#conversations)
5. [Sessions & Session Context Links](#sessions)
6. [Sharing: Conversations & Content](#shared-conversations)
7. [AI Agent: Runs, Approvals, Interactions](#agent-runs)
8. [Skills & MCP Servers](#skills)
9. [Scheduling & Rules](#scheduled-actions)
10. [Integrations & Credentials](#integrations)
11. [Analytics: Usage, Sandbox, Audit](#usage-logs)
12. [Canvas](#canvases)
13. [Notifications & Inbox](#notifications)
14. [Ditto Profiles](#ditto-profiles)
15. [Platform & Config](#platform-config)
16. [Database Functions](#database-functions)

---

## organizations

Stores multi-tenant organizations. Auto-created on user signup via `handle_new_user()` trigger.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| name | text | NO | | Org display name |
| slug | text | NO | | URL-safe unique identifier |
| stripe_customer_id | text | YES | | Stripe customer for billing |
| credit_balance | integer | NO | 50 | AI credit balance |
| created_at | timestamptz | NO | `now()` | Creation timestamp |

**Indexes:** `slug` (unique)

**RLS:** Members can SELECT their own orgs via `get_user_org_ids()`.

**Key queries:** Lookup by slug for routing; credit_balance checks before AI operations.

---

## org_members

Junction table linking users to organizations with roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| role | text | NO | `'member'` | `'owner'`, `'admin'`, `'member'` |

**Indexes:** UNIQUE(org_id, user_id)

**RLS:** Members can SELECT members of their own orgs.

**Key queries:** `SELECT org_id FROM org_members WHERE user_id = ?` -- used by every authenticated API route to resolve org context.

---

## org_invitations

Pending team invitations. Expires after 7 days.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| email | text | NO | | Invitee email |
| role | text | NO | `'member'` | Role to assign on accept |
| invited_by | uuid | NO | | FK -> auth.users |
| status | text | NO | `'pending'` | `'pending'`, `'accepted'`, `'expired'`, `'revoked'` |
| created_at | timestamptz | NO | `now()` | |
| expires_at | timestamptz | NO | `now() + 7 days` | |
| accepted_at | timestamptz | YES | | |

**Indexes:** (email, status); UNIQUE(org_id, email)

**RLS:** Org members can SELECT their org's invitations.

**Key queries:** Lookup by email on signup to skip auto-org creation; `accept_invitation()` RPC to join org.

---

## context_items

Central knowledge store. Every piece of ingested content (meetings, docs, messages, issues, files) becomes a context item. Vector embeddings enable semantic search.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| source_type | text | NO | | `'google-drive'`, `'github'`, `'slack'`, `'linear'`, `'discord'`, `'upload'`, `'granola'`, etc. (no CHECK -- relaxed) |
| source_id | text | YES | | External ID from source system |
| nango_connection_id | text | YES | | Nango connection that imported this |
| title | text | NO | | Display title |
| description_short | text | YES | | One-line summary |
| description_long | text | YES | | Multi-paragraph summary |
| raw_content | text | YES | | Full original content |
| content_type | text | NO | | `'meeting_transcript'`, `'document'`, `'message'`, `'issue'`, `'file'`, etc. (no CHECK -- relaxed) |
| entities | jsonb | YES | | Extracted: `{topics, action_items, people, decisions}` |
| embedding | vector(1536) | YES | | text-embedding-3-small vector |
| search_tsv | tsvector | YES | Generated stored | Full-text search vector (title + description_long + raw_content) |
| status | text | NO | `'pending'` | `'pending'`, `'processing'`, `'ready'`, `'error'` |
| source_metadata | jsonb | YES | | Source-specific metadata (URL, author, etc.) |
| source_created_at | timestamptz | YES | | Original creation date in source |
| ingested_at | timestamptz | NO | `now()` | When imported |
| processed_at | timestamptz | YES | | When AI extraction completed |
| content_hash | text | YES | | SHA hash for change detection on re-sync |
| priority_weight | integer | NO | 0 | Manual priority boost |
| confidence_score | float | YES | 1.0 | AI confidence in extraction quality |
| source_quote | text | YES | | Key quote from source |
| version_number | integer | NO | 1 | Current version |
| updated_at | timestamptz | YES | `now()` | Last modified (auto-trigger) |
| freshness_at | timestamptz | YES | `now()` | Content freshness timestamp |
| user_title | text | YES | | User-overridden title (never overwritten by sync) |
| user_notes | text | YES | | User annotations |
| user_tags | text[] | YES | `'{}'` | User-applied tags |
| trust_weight | real | NO | 1.0 | User trust weighting (0.1-2.0) |
| archived_at | timestamptz | YES | | Soft archive timestamp |
| last_viewed_at | timestamptz | YES | | Last viewed |
| view_count | integer | YES | 0 | View counter |
| ai_category | text | YES | | AI-assigned category |
| staleness_score | float | YES | 0 | Computed staleness (0-1) |

**Indexes:**
- (org_id, status)
- (org_id, source_type)
- (org_id, content_type)
- HNSW on embedding (vector_cosine_ops)
- GIN on search_tsv
- GIN on full-text (title || description_long || raw_content)
- Partial UNIQUE: (org_id, source_type, source_id) WHERE source_id IS NOT NULL
- updated_at, freshness_at
- (org_id, archived_at) WHERE archived_at IS NOT NULL
- (org_id, staleness_score DESC) WHERE staleness_score > 0.5

**RLS:** Org members can SELECT and manage their org's items.

**Key queries:**
- Hybrid search via `hybrid_search()` and `hybrid_search_chunks()` RPCs
- Filter by org_id + status='ready' for search-eligible items
- Upsert dedup via (org_id, source_type, source_id) partial index

---

## context_chunks

Child chunks for scalable vector search. Each context_item is split into chunks with parent_content for LLM context retrieval.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations (denormalized for fast queries) |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| chunk_index | integer | NO | | Position within parent document |
| content | text | NO | | Chunk text (for matching) |
| parent_content | text | NO | | Surrounding context (for LLM) |
| metadata | jsonb | YES | `'{}'` | Chunk-level metadata |
| embedding | vector(1536) | YES | | Chunk embedding |
| search_tsv | tsvector | YES | Generated stored | Full-text on chunk content |
| embedding_model | text | YES | `'text-embedding-3-small'` | Model used |
| embedded_at | timestamptz | YES | `now()` | When embedding was generated |
| created_at | timestamptz | YES | `now()` | |

**Indexes:**
- (context_item_id)
- (org_id)
- HNSW on embedding (vector_cosine_ops)
- GIN on search_tsv

**RLS:** Org members can SELECT their org's chunks.

**Key queries:** `hybrid_search_chunks()` RPC for precision search; max 2 chunks per document in results.

---

## context_item_versions

Full version history for change tracking. Every sync, edit, or status change creates a record.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| org_id | uuid | NO | | FK -> organizations |
| version_number | integer | NO | | Sequential version |
| title | text | NO | | Title at this version |
| raw_content | text | YES | | Content snapshot |
| content_hash | text | YES | | Hash at this version |
| source_metadata | jsonb | YES | | Metadata snapshot |
| change_type | text | NO | | `'created'`, `'content_updated'`, `'metadata_updated'`, `'status_changed'`, `'deleted'` |
| changed_fields | text[] | YES | `'{}'` | Which fields changed |
| changed_by | text | YES | | e.g., `'sync:linear'`, `'user:<id>'`, `'webhook:discord'` |
| created_at | timestamptz | NO | `now()` | |
| source_updated_at | timestamptz | YES | | |

**Indexes:** UNIQUE(context_item_id, version_number); (context_item_id, version_number DESC); (org_id, created_at DESC)

**RLS:** Org members can SELECT versions in their org.

---

## document_versions

User-initiated edit history. When a user edits a document via PATCH, the previous state is saved here.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| version_number | integer | NO | | Sequential |
| title | text | NO | | Title at this version |
| content | text | NO | | Full content snapshot |
| edited_by | uuid | NO | | FK -> auth.users |
| change_summary | text | YES | | Description of changes |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(context_item_id, version_number); (context_item_id, version_number DESC)

**RLS:** Org members can SELECT and INSERT for their org's items.

---

## collections

User-created folders for organizing context items. Supports nesting via parent_id and smart filters.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| parent_id | uuid | YES | | FK -> collections (self-referencing for nesting) |
| name | text | NO | | Collection name |
| description | text | YES | | |
| icon | text | YES | | Icon emoji or class |
| color | text | YES | | CSS color |
| sort_order | integer | YES | 0 | Display order |
| is_smart | boolean | YES | false | Auto-populated by filter |
| smart_filter | jsonb | YES | | Filter criteria for smart collections |
| created_by | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | YES | `now()` | |
| updated_at | timestamptz | YES | `now()` | |

**Indexes:** (org_id, parent_id); (org_id, is_smart) WHERE is_smart = true

**RLS:** Full CRUD for org members.

---

## collection_items

Many-to-many linking context items to collections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| collection_id | uuid | NO | | FK -> collections ON DELETE CASCADE |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| sort_order | integer | YES | 0 | |
| added_by | uuid | YES | | FK -> auth.users |
| added_at | timestamptz | YES | `now()` | |

**Indexes:** UNIQUE(collection_id, context_item_id); (context_item_id); (collection_id)

**RLS:** Full CRUD via collection's org membership.

---

## tags

Org-scoped tag definitions. Can be user-created, AI-generated, or system tags.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations ON DELETE CASCADE |
| name | text | NO | | Tag label |
| color | text | YES | | CSS color |
| tag_type | text | YES | `'user'` | `'user'`, `'ai'`, `'system'` |
| usage_count | integer | YES | 0 | |
| created_by | uuid | YES | | FK -> auth.users |
| created_at | timestamptz | YES | `now()` | |

**Indexes:** UNIQUE(org_id, name); (org_id, name); (org_id, usage_count DESC)

**RLS:** Full CRUD for org members.

---

## item_tags

Many-to-many tags on context items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| tag_id | uuid | NO | | FK -> tags ON DELETE CASCADE |
| source | text | YES | `'user'` | `'user'` or `'ai'` |
| confidence | float | YES | 1.0 | AI confidence (for AI-applied tags) |
| added_at | timestamptz | YES | `now()` | |

**Indexes:** UNIQUE(context_item_id, tag_id); (context_item_id); (tag_id)

**RLS:** Full CRUD via tag's org membership.

---

## item_pins

User-scoped quick-access pins for context items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| user_id | uuid | NO | | FK -> auth.users ON DELETE CASCADE |
| context_item_id | uuid | NO | | FK -> context_items ON DELETE CASCADE |
| pinned_at | timestamptz | YES | `now()` | |

**Indexes:** UNIQUE(user_id, context_item_id); (user_id, pinned_at DESC)

**RLS:** User-scoped -- users can only manage their own pins.

---

## conversations

Multi-conversation chat support. Each conversation belongs to an org and user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations ON DELETE CASCADE |
| user_id | uuid | NO | | FK -> auth.users ON DELETE CASCADE |
| title | text | YES | | Auto-generated or user-set |
| compacted_summary | text | YES | | Compressed context for long conversations |
| initiated_by | text | NO | `'user'` | `'user'`, `'system'`, `'schedule'` |
| schedule_id | uuid | YES | | FK -> scheduled_actions (if schedule-initiated) |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, updated_at DESC); (user_id, updated_at DESC); (org_id, initiated_by, created_at DESC) WHERE initiated_by != 'user'

**RLS:** Org members can SELECT conversations in their org.

**Key queries:** List by org ordered by updated_at; filter by initiated_by for schedule-triggered chats.

---

## chat_messages

Persisted chat messages. Supports UIMessage parts format from Vercel AI SDK.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations ON DELETE CASCADE |
| user_id | uuid | NO | | FK -> auth.users ON DELETE CASCADE |
| session_id | uuid | YES | | FK -> sessions (null = not session-scoped) |
| conversation_id | uuid | YES | | FK -> conversations ON DELETE CASCADE |
| role | text | NO | | `'user'` or `'assistant'` |
| content | jsonb | NO | `'[]'` | UIMessage parts array |
| model | text | YES | | Model used (assistant messages only) |
| channel | text | NO | `'web'` | `'web'`, `'discord'`, `'slack'` |
| discord_channel_id | text | YES | | Discord channel reference |
| discord_message_id | text | YES | | Discord message reference |
| created_at | timestamptz | NO | `now()` | |

**Indexes:**
- (org_id, created_at) WHERE session_id IS NULL -- global chat
- (session_id, created_at) WHERE session_id IS NOT NULL -- session chat
- (conversation_id, created_at) WHERE conversation_id IS NOT NULL

**RLS:** Org members can SELECT their org's messages. Inserts are server-side only (service role).

---

## shared_conversations

Direct sharing of conversations between team members.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| conversation_id | uuid | NO | | Conversation being shared |
| shared_by | uuid | NO | | FK -> auth.users |
| shared_with | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(conversation_id, shared_with)

**RLS:** Users can see shares they created or received; can create shares as themselves.

---

## content_shares

Fine-grained sharing of context items and artifacts between users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| content_id | uuid | NO | | ID of shared resource |
| content_type | text | NO | | `'context_item'` or `'artifact'` |
| shared_by | uuid | NO | | FK -> auth.users |
| shared_with | uuid | NO | | FK -> auth.users |
| permission | text | NO | `'viewer'` | `'viewer'`, `'editor'`, `'owner'` |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(content_id, content_type, shared_with); (shared_with); (content_id, content_type)

**RLS:** Users can see shares involving them; creators can create and delete.

---

## public_content_shares

Public shareable links for artifacts, context items, and skills.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| share_token | text | NO | Random 32-char hex | Unique public token |
| org_id | uuid | NO | | FK -> organizations |
| shared_by | uuid | NO | | FK -> auth.users |
| resource_type | text | NO | | `'artifact'`, `'context_item'`, `'skill'` |
| resource_id | uuid | NO | | ID of shared resource |
| is_active | boolean | NO | true | Toggle link on/off |
| allow_public_view | boolean | NO | true | |
| password_hash | text | YES | | Optional password protection |
| expires_at | timestamptz | YES | | Optional expiry |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (share_token) WHERE is_active = TRUE; (resource_type, resource_id)

**RLS:** Creators can manage their shares.

---

## agent_runs

Tracks every agentic chat request for analytics and quality monitoring.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | NO | `now()` | |
| model | text | NO | | Model ID used |
| query | text | NO | | First user message |
| step_count | integer | NO | 0 | Agent loop steps |
| finish_reason | text | YES | | `'stop'`, `'step-limit'`, etc. |
| total_input_tokens | integer | YES | | |
| total_output_tokens | integer | YES | | |
| duration_ms | integer | YES | | Request duration |
| tool_calls | jsonb | NO | `'[]'` | Array of `{tool, count}` |
| error | text | YES | | Error message if failed |

**Indexes:** (org_id, created_at DESC); (model)

**RLS:** Org members can SELECT their org's runs. Inserts are server-side only.

---

## approval_queue

Human-in-the-loop approval for agent-requested actions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| requested_by_agent | text | NO | `'granger'` | Agent name |
| action_type | text | NO | | Action category |
| target_service | text | NO | | Service to act on |
| payload | jsonb | NO | | Action details |
| reasoning | text | YES | | Agent's reasoning |
| conflict_reason | text | YES | | Why approval needed |
| status | text | NO | `'pending'` | `'pending'`, `'approved'`, `'rejected'`, `'expired'` |
| reviewed_by | uuid | YES | | FK -> auth.users |
| reviewed_at | timestamptz | YES | | |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, status); (org_id, created_at DESC)

**RLS:** Org members have full access.

---

## user_interactions

Tracks user behavior for Ditto personalization engine.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| interaction_type | text | NO | | `'search'`, `'click'`, `'dismiss'`, `'star'`, `'chat_query'`, `'dwell'`, `'export'` |
| resource_type | text | YES | | `'context_item'`, `'search_result'`, `'inbox_item'`, `'session'` |
| resource_id | uuid | YES | | |
| query | text | YES | | Search/chat query text |
| source_type | text | YES | | |
| content_type | text | YES | | |
| metadata | jsonb | YES | `'{}'` | Additional context (dwell time, position, etc.) |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (user_id, created_at DESC); (org_id, created_at DESC); (user_id, interaction_type)

**RLS:** Users can SELECT and INSERT their own interactions only.

---

## skills

Org-scoped AI skill definitions. Skills define system prompts, tool configurations, and reference files.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| slug | text | NO | | URL-safe identifier |
| name | text | NO | | Display name |
| description | text | NO | | What the skill does |
| version | text | NO | `'1.0.0'` | SemVer |
| author | text | YES | | |
| category | text | NO | `'general'` | Skill category |
| icon | text | YES | | Emoji icon |
| system_prompt | text | YES | | Injected system prompt |
| tools | jsonb | YES | `'[]'` | Tool configurations |
| config | jsonb | YES | `'{}'` | Additional config |
| reference_files | jsonb | NO | `'[]'` | Array of `{name, content, type}` injected on activation |
| slash_command | text | YES | | Slash command trigger |
| is_active | boolean | NO | true | |
| is_builtin | boolean | NO | false | System-provided skill |
| install_count | integer | NO | 0 | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(org_id, slug)

**RLS:** Org members have full access.

---

## mcp_servers

MCP (Model Context Protocol) server connections per organization.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| name | text | NO | | Display name |
| url | text | NO | | Server endpoint URL |
| api_key_encrypted | text | YES | | Encrypted bearer token |
| transport_type | text | NO | `'http'` | `'http'` or `'sse'` |
| auth_type | text | NO | `'bearer'` | `'bearer'`, `'oauth'`, `'none'` |
| is_active | boolean | NO | true | |
| discovered_tools | jsonb | YES | `'[]'` | Tools discovered on connect |
| last_connected_at | timestamptz | YES | | |
| error_message | text | YES | | Last error |
| oauth_refresh_token | text | YES | | OAuth refresh token |
| oauth_expires_at | timestamptz | YES | | OAuth token expiry |
| oauth_authorize_url | text | YES | | OAuth authorize endpoint |
| oauth_token_url | text | YES | | OAuth token endpoint |
| oauth_client_id | text | YES | | OAuth client ID |
| oauth_client_secret | text | YES | | OAuth client secret |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(org_id, url)

**RLS:** Org members have full access.

---

## scheduled_actions

Recurring and one-shot tasks managed by the agent.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| created_by | uuid | NO | | FK -> auth.users |
| name | text | NO | | Schedule name |
| description | text | YES | | |
| action_type | text | NO | | `'query'`, `'sync'`, `'digest'`, `'custom'` |
| target_service | text | YES | | Target integration |
| payload | jsonb | NO | `'{}'` | Action parameters |
| schedule | text | NO | | Cron expression or `'once:ISO_DATE'` |
| next_run_at | timestamptz | YES | | Computed next execution |
| last_run_at | timestamptz | YES | | |
| status | text | NO | `'active'` | `'active'`, `'paused'`, `'completed'`, `'failed'` |
| run_count | integer | NO | 0 | |
| max_runs | integer | YES | | null = unlimited, 1 = one-shot |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (next_run_at) WHERE status = 'active'

**RLS:** Org members have full access.

---

## rules

User-defined instructions injected into the agent system prompt.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| text | text | NO | | Rule instruction text |
| is_active | boolean | NO | true | |
| priority | integer | NO | 0 | Sort order |
| scope | text | NO | `'personal'` | `'personal'` or `'org'` |
| applies_to_all | boolean | NO | false | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id) WHERE is_active = true; (org_id, scope) WHERE scope = 'org'

**RLS:** Org members have full access.

---

## priority_documents

Brand/strategy docs that influence AI context with weighted priority.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| filename | text | NO | | Document name |
| content | text | NO | | Full document text |
| weight | integer | NO | 100 | Priority weight (lower = higher priority) |
| is_active | boolean | NO | true | Toggle |
| updated_at | timestamptz | NO | `now()` | |
| created_at | timestamptz | NO | `now()` | |

**RLS:** Org members have full access.

---

## integrations

Nango-based OAuth integrations per organization.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| provider | text | NO | | `'google-drive'`, `'github'`, `'slack'`, `'linear'`, `'discord'` |
| nango_connection_id | text | NO | | Nango connection reference |
| status | text | NO | `'active'` | `'active'`, `'paused'`, `'error'` |
| last_sync_at | timestamptz | YES | | |
| sync_config | jsonb | YES | | Provider-specific sync settings |
| created_by | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(org_id, provider)

**RLS:** Org members can SELECT and manage.

---

## credentials

Encrypted credentials for third-party service integrations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | YES | | FK -> auth.users |
| provider | text | NO | | Service provider name |
| token_encrypted | text | NO | | Encrypted access token |
| refresh_token_encrypted | text | YES | | Encrypted refresh token |
| expires_at | timestamptz | YES | | Token expiry |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(org_id, user_id, provider)

**RLS:** Org members have full access.

---

## usage_logs

Token and cost tracking for all AI operations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | YES | | FK -> auth.users |
| operation | text | NO | | `'chat'`, `'extraction'`, `'embedding'`, `'query_expansion'`, `'inbox_generation'` |
| model | text | NO | | Model ID |
| input_tokens | integer | YES | 0 | |
| output_tokens | integer | YES | 0 | |
| total_tokens | integer | | Generated: input + output | |
| cost_usd | numeric(10,6) | YES | 0 | |
| credits_used | numeric(6,2) | YES | 0 | |
| metadata | jsonb | YES | `'{}'` | |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, created_at DESC); (org_id, operation)

**RLS:** Org members can SELECT.

---

## sandbox_snapshots

Persisted Vercel Sandbox VM state for instant restore.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| name | text | NO | | Snapshot name |
| snapshot_id | text | NO | | Vercel sandbox snapshot ID |
| metadata | jsonb | YES | `'{}'` | File list, packages, runtime |
| cpu_usage_ms | bigint | YES | 0 | |
| network_ingress_bytes | bigint | YES | 0 | |
| network_egress_bytes | bigint | YES | 0 | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, created_at DESC)

**RLS:** Org members have full access.

---

## sandbox_usage

Per-execution compute cost tracking for sandbox environments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | text | YES | | User identifier (text, not FK) |
| sandbox_id | text | YES | | Sandbox identifier |
| cpu_ms | bigint | YES | 0 | |
| memory_mb_seconds | bigint | YES | 0 | |
| network_ingress_bytes | bigint | YES | 0 | |
| network_egress_bytes | bigint | YES | 0 | |
| cost_usd | numeric(10,6) | YES | 0 | |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, created_at DESC); (org_id, user_id)

**RLS:** Org members have full access.

---

## audit_log

Tracks user and system actions for compliance and debugging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | YES | | |
| action | text | NO | | Action name (e.g., `'chat_feedback'`) |
| resource_type | text | YES | | Resource kind |
| resource_id | text | YES | | Resource identifier |
| metadata | jsonb | NO | `'{}'` | Action details |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, created_at DESC)

**RLS:** Org members can SELECT.

---

## canvases

Visual context mapping canvases.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| name | text | NO | | |
| description | text | YES | | |
| viewport | jsonb | YES | `'{"x":0,"y":0,"zoom":1}'` | Camera state |
| settings | jsonb | YES | `'{}'` | |
| created_by | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, updated_at DESC)

**RLS:** Org members have full access.

---

## canvas_items

Nodes on a canvas -- either linked context items or freeform notes/labels.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| canvas_id | uuid | NO | | FK -> canvases ON DELETE CASCADE |
| context_item_id | uuid | YES | | FK -> context_items (null for notes/labels) |
| x | real | NO | 0 | X position |
| y | real | NO | 0 | Y position |
| width | real | NO | 300 | |
| height | real | NO | 200 | |
| color | text | YES | | |
| style | jsonb | YES | `'{}'` | |
| item_type | text | NO | `'context'` | `'context'`, `'note'`, `'label'`, `'group'` |
| content | text | YES | | Text content for notes/labels |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** (canvas_id)

**RLS:** Via canvas org membership.

---

## canvas_connections

Edges between canvas items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| canvas_id | uuid | NO | | FK -> canvases ON DELETE CASCADE |
| from_item_id | uuid | NO | | FK -> canvas_items ON DELETE CASCADE |
| to_item_id | uuid | NO | | FK -> canvas_items ON DELETE CASCADE |
| label | text | YES | | Edge label |
| style | jsonb | YES | `'{}'` | |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(canvas_id, from_item_id, to_item_id); (canvas_id)

**RLS:** Via canvas org membership.

---

## notifications

User-facing notifications for chat mentions, shares, schedules, approvals, and library updates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| type | text | NO | | `'chat_mention'`, `'share'`, `'schedule_complete'`, `'approval_needed'`, `'library_update'` |
| title | text | NO | | |
| body | text | YES | | |
| link | text | YES | | URL to navigate on click |
| metadata | jsonb | YES | `'{}'` | |
| is_read | boolean | NO | false | |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (user_id, is_read, created_at DESC) WHERE is_read = FALSE; (user_id, created_at DESC)

**RLS:** Users can SELECT and manage their own notifications.

---

## notification_preferences

Per-user notification settings per org.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| user_id | uuid | NO | | FK -> auth.users |
| org_id | uuid | NO | | FK -> organizations |
| digest_enabled | boolean | NO | true | |
| digest_time | text | NO | `'07:00'` | HH:MM format |
| email_on_mention | boolean | NO | true | |
| email_on_action_item | boolean | NO | true | |
| email_on_new_context | boolean | NO | false | |
| weekly_summary | boolean | NO | true | |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(user_id, org_id); (user_id)

**RLS:** Users manage their own preferences.

---

## inbox_items

User inbox for action items, decisions, mentions, and alerts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| context_item_id | uuid | YES | | FK -> context_items |
| type | text | NO | | `'action_item'`, `'decision'`, `'mention'`, `'new_context'`, `'overdue'` |
| title | text | NO | | |
| body | text | YES | | |
| priority | text | NO | `'normal'` | `'urgent'`, `'high'`, `'normal'`, `'low'` |
| status | text | NO | `'unread'` | `'unread'`, `'read'`, `'acted'`, `'dismissed'` |
| source_type | text | YES | | |
| source_url | text | YES | | |
| created_at | timestamptz | NO | `now()` | |
| read_at | timestamptz | YES | | |

**Indexes:** (org_id, user_id, status)

**RLS:** User-scoped -- users manage their own inbox items.

---

## ditto_profiles

AI personalization profiles learned from user interactions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| user_id | uuid | NO | | FK -> auth.users |
| interests | jsonb | YES | `'[]'` | Array of interest strings |
| preferred_sources | jsonb | YES | `'{}'` | Source weights: `{"linear": 0.8}` |
| communication_style | text | YES | `'balanced'` | `'formal'`, `'casual'`, `'balanced'` |
| detail_level | text | YES | `'moderate'` | `'brief'`, `'moderate'`, `'detailed'` |
| priority_topics | jsonb | YES | `'[]'` | |
| working_hours | jsonb | YES | `'{"start":9,"end":17}'` | |
| interaction_count | integer | YES | 0 | |
| last_generated_at | timestamptz | YES | | |
| confidence | real | YES | 0.0 | Profile confidence (0-1) |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**Indexes:** UNIQUE(user_id, org_id)

**RLS:** Users can SELECT and manage their own profile.

---

## partner_settings

Per-user settings including AI gateway keys, notification prefs, and tool permissions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| user_id | uuid | NO | | FK -> auth.users (UNIQUE) |
| ai_gateway_key_encrypted | text | YES | | Encrypted AI gateway key |
| default_model | text | YES | | Preferred model |
| discord_user_id | text | YES | | |
| notification_preferences | jsonb | YES | `'{}'` | |
| approval_preferences | jsonb | YES | `'{}'` | |
| tool_permissions | jsonb | YES | `'{}'` | Per-service `{read, write}` |
| timezone | text | YES | `'America/New_York'` | User timezone |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |

**RLS:** User-scoped.

---

## edit_proposals

Majority-approval system for shared document edits.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| context_item_id | uuid | NO | | FK -> context_items |
| org_id | uuid | NO | | FK -> organizations |
| proposed_by | uuid | NO | | FK -> auth.users |
| proposed_title | text | YES | | |
| proposed_content | text | NO | | Full proposed content |
| change_summary | text | YES | | |
| status | text | NO | `'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| approvals | jsonb | YES | `'[]'` | Array of `{user_id, approved, timestamp}` |
| required_approvals | integer | NO | 2 | Majority threshold |
| created_at | timestamptz | NO | `now()` | |

**Indexes:** (org_id, status); (context_item_id); (org_id, created_at DESC)

**RLS:** Org members have full access.

---

## Additional Tables

### sessions

Research/project sessions for focused agent work.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | Primary key |
| org_id | uuid | NO | | FK -> organizations |
| name | text | NO | | |
| goal | text | NO | | |
| status | text | NO | `'active'` | `'active'`, `'paused'`, `'archived'` |
| agent_config | jsonb | YES | | |
| compacted_summary | text | YES | | |
| created_by | uuid | NO | | FK -> auth.users |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | Auto-trigger |
| last_agent_run | timestamptz | YES | | |

### session_context_links, session_members

Junction tables for sessions -- link context items and users to sessions.

### action_item_status

Tracks completion status of action items extracted from context_items.entities.

### saved_searches

User or org-shared saved search queries with filters.

### webhook_events

Idempotency table preventing duplicate webhook processing.

### session_insights

AI-generated insights about cross-source connections within sessions.

### device_tokens

Push notification tokens for mobile (iOS/Android via Capacitor).

### platform_config

Super-admin platform configuration (no RLS). Stores model pricing, credit config, and packages.

---

## Database Functions

| Function | Description |
|----------|-------------|
| `get_user_org_ids()` | Returns org IDs for current user. Used by most RLS policies. |
| `handle_new_user()` | Trigger: auto-creates org on signup (skips if pending invitation exists). |
| `handle_updated_at()` | Trigger: sets `updated_at = now()` on UPDATE. |
| `accept_invitation(invitation_id, user_id)` | RPC: accepts invitation and adds user to org. |
| `search_context_items(org_id, query, embedding, limit)` | RPC: hybrid search with RRF (legacy). |
| `search_context_items_text(org_id, query, limit)` | RPC: text-only fallback search (legacy). |
| `hybrid_search(org_id, query, embedding, limit, filters...)` | RPC: hybrid search with source/content/date filters. |
| `hybrid_search_text(org_id, query, limit, filters...)` | RPC: text-only with filters. |
| `hybrid_search_chunks(org_id, query, embedding, limit, filters...)` | RPC: chunk-level hybrid search, deduped to max 2 per doc. |
| `get_context_health(org_id)` | RPC: pipeline health metrics (status counts, embedding coverage, freshness). |
| `get_integration_health(org_id)` | RPC: per-provider sync status and item counts. |
| `get_agent_metrics(org_id, since)` | RPC: agent run analytics with trends and model breakdown. |
| `get_action_items(org_id, status, source_type, limit, offset)` | RPC: action items with status across all context items. |
| `add_credits(org_id, amount)` | RPC: add credits (called by Stripe webhook). |
| `deduct_credits(org_id, amount)` | RPC: deduct credits (fails if insufficient). |
