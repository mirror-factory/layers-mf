> **⚠️ ARCHIVED** — This document is outdated. See [org-permissions-system.md](../org-permissions-system.md) for current information.
> Moved to archive on 2026-04-06.

---

# Accounts, Organizations & Content Sharing — Architecture Document

> Last updated: 2026-04-02

---

## 1. Account Model

### How Users and Orgs Work

```
User (auth.users)
  ├── Profile (profiles table)
  │     email, display_name, avatar_url
  │
  └── Org Membership (org_members table)
        ├── org_id → organizations table
        ├── role: "owner" | "admin" | "member"
        └── user_id → auth.users
```

**Key rules:**
- Each user authenticates via Supabase Auth (Google OAuth or email/password)
- Each user belongs to ONE organization (currently — multi-org not supported yet)
- Organizations own ALL content — context items, artifacts, conversations, schedules, etc.
- When a user creates something, it's stored under `org_id`, not `user_id`

### Database Tables

**`auth.users`** (Supabase managed)
- id, email, user_metadata (display_name, avatar_url)

**`profiles`**
- id (= auth.users.id), display_name, avatar_url, created_at

**`organizations`**
- id, name, slug, created_at

**`org_members`**
- id, org_id, user_id, role, created_at

**`org_invitations`**
- id, org_id, email, role, invited_by, accepted, created_at

---

## 2. Content Ownership — Everything is Org-Scoped

Every piece of content has an `org_id` column. This means:

| Content | Table | Scoped by |
|---------|-------|-----------|
| Context items (docs, files, messages) | `context_items` | org_id |
| Artifacts (code, documents, sandboxes) | `artifacts` | org_id |
| Artifact versions | `artifact_versions` | via artifacts.org_id |
| Artifact files | `artifact_files` | via artifacts.org_id |
| Conversations | `conversations` | org_id |
| Chat messages | `chat_messages` | org_id |
| MCP servers | `mcp_servers` | org_id |
| Integrations (Nango) | `integrations` | org_id |
| Schedules | `scheduled_actions` | org_id |
| Approvals | `approvals` | org_id |
| Inbox items | `inbox_items` | user_id (not org!) |
| Priority documents | `priority_documents` | org_id |
| Rules | `rules` | org_id |
| Skills | `skills` | org_id |
| API keys | `api_keys` | org_id |

**Important exception:** `inbox_items` is scoped by `user_id`, not `org_id`. Each person sees their own inbox.

---

## 3. How Content Sharing Works

### Within an Organization

**All org members see everything.** There is no per-user content isolation within an org. If Alfonso creates an artifact, Kyle and Bobby can see it immediately.

This is enforced by Row Level Security (RLS):
```sql
-- Example: artifacts table RLS
CREATE POLICY "artifacts_org_access" ON artifacts
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
```

Every query checks: "is the current user a member of the org that owns this content?"

### Between Organizations

**Zero sharing.** Content from org A is completely invisible to org B. No cross-org queries are possible through the API.

### The Admin Client (Service Role)

Backend API routes use `createAdminClient()` which bypasses RLS. This is used for:
- Cron jobs (digest, ingest, synthesis)
- Webhooks (Stripe, Linear, Nango)
- Background processing (embeddings, entity extraction)
- Tool execution (the AI tools run server-side with admin access)

```typescript
// Server component — uses the user's auth context (RLS enforced)
const supabase = await createClient();

// API route — uses admin client (bypasses RLS)
const adminDb = createAdminClient();
```

---

## 4. How the AI Sees Content

When a user chats with Granger:

1. **Auth check:** API route verifies the user's session via Supabase Auth
2. **Org lookup:** Finds the user's org via `org_members`
3. **Tool creation:** `createTools(supabase, orgId)` — all tools are scoped to the org
4. **Search:** `search_context` queries `context_items` filtered by `org_id`
5. **Artifacts:** All artifact tools query `artifacts` filtered by `org_id`

The AI can ONLY access content belonging to the user's organization. It cannot:
- See other orgs' content
- Access another user's inbox items
- Query without an org_id filter

---

## 5. Roles and Permissions

### Org Roles

| Role | Can do |
|------|--------|
| **owner** | Everything + delete org + manage billing |
| **admin** | Everything except delete org |
| **member** | Read/write content, chat, use tools |

### Tool Permissions (Per-Service)

Each org member has per-service permissions stored in the permissions system:

```typescript
type ServicePermission = { read: boolean; write: boolean };

type ToolPermissions = {
  linear?: ServicePermission;
  gmail?: ServicePermission;
  notion?: ServicePermission;
  granola?: ServicePermission;
  drive?: ServicePermission;
};
```

This controls which specialist agents and direct API tools a user can access. For example:
- `linear: { read: true, write: false }` — can view issues but not create them
- `gmail: { read: false, write: false }` — no email access at all

Managed at: `/settings/permissions`

---

## 6. How Integrations Connect to Orgs

### Nango OAuth Integrations

```
Organization
  └── integrations table
        ├── provider: "google-drive" | "github" | "slack" | "linear"
        ├── nango_connection_id: "conn_abc123"
        ├── status: "active" | "error"
        └── last_sync_at
```

When a user connects Google Drive:
1. OAuth flow via Nango
2. `integrations` row created with org_id
3. Webhook syncs files → `context_items` with org_id
4. All org members can now search those Drive files

### MCP Servers

MCP servers are org-scoped too:
```
Organization
  └── mcp_servers table
        ├── name: "Granola" | "GitHub"
        ├── url: "https://..."
        ├── is_active: true
        ├── discovered_tools: [{name: "list_meetings"}, ...]
        └── oauth credentials (per-server)
```

All org members share the same MCP connections.

---

## 7. What Happens When You Invite Someone

1. Owner/admin sends invite via `/settings/team`
2. `org_invitations` row created with email + role
3. Invite email sent
4. New user signs up → `org_members` row created
5. They immediately see ALL org content (context library, artifacts, conversations, etc.)
6. They share the same integrations, MCP servers, rules, priority docs

---

## 8. Current Limitations

1. **Single org per user** — a user can only belong to one organization
2. **No content-level permissions** — can't restrict specific documents to specific members
3. **No guest access** — external collaborators can't view shared artifacts
4. **No public sharing** — can't generate a public link to an artifact
5. **No transfer** — can't move an artifact between orgs
6. **Inbox is per-user** — but everything else is shared

---

## 9. Future Considerations

### Multi-Org Support
- User can belong to multiple orgs
- Org switcher in sidebar
- Separate context/artifacts per org

### Content-Level Permissions
- Mark artifacts as "private" (only creator can see)
- Share specific artifacts with specific members
- Team-based access (Engineering can see code, Marketing can see docs)

### Public Sharing
- Generate public link to an artifact
- Read-only preview for non-members
- Optional password protection
- Embeddable iframes for sandboxes

### SDK / Multi-Tenant
- Each SDK customer gets their own org
- Tenant isolation via org_id
- Per-tenant billing via AI Gateway tags
