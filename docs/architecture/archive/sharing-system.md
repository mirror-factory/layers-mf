> **⚠️ ARCHIVED** — This document is outdated. See [sharing-permissions.md](../sharing-permissions.md) and [library-hub-and-sharing.md](../library-hub-and-sharing.md) for current information.
> Moved to archive on 2026-04-06.

---

# Sharing System — Architecture Document

> Status: Implemented (basic)
> Date: 2026-04-05

## Overview

Layers supports two sharing mechanisms for conversations:
1. **Team sharing** — Share with specific org members (user-to-user)
2. **Public links** — Generate a read-only URL anyone can view

## Database Schema

### `shared_conversations` (team sharing)
```sql
id UUID PRIMARY KEY
conversation_id UUID NOT NULL
shared_by UUID NOT NULL (FK auth.users)
shared_with UUID NOT NULL (FK auth.users)
created_at TIMESTAMPTZ
UNIQUE(conversation_id, shared_with)
```

### `public_chat_shares` (public links)
```sql
id UUID PRIMARY KEY
conversation_id TEXT NOT NULL
org_id UUID NOT NULL
shared_by UUID NOT NULL (FK auth.users)
share_token TEXT NOT NULL UNIQUE  -- 32-char hex token
is_active BOOLEAN DEFAULT true
allow_org_view BOOLEAN DEFAULT true  -- org members can view
allow_public_view BOOLEAN DEFAULT false  -- anyone with link can view
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ  -- optional expiry
```

## API Endpoints

### Team Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/share` | Share with specific user IDs |
| GET | `/api/chat/share?conversation_id=X` | Get list of shared users |

### Public Links
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/share-link` | Create/reactivate a public share link |
| DELETE | `/api/chat/share-link` | Deactivate a share link |

## Share Page

**Route:** `/share/[token]`

Read-only view of the conversation:
- No sidebar, no chat input, no action buttons
- User messages in primary color bubbles (right-aligned)
- AI responses in card style (left-aligned)
- Tool calls shown as compact badges with checkmarks
- Header: conversation title + date + Layers branding
- Footer: "Powered by Layers"

### Access Control
- `allow_public_view = true`: No auth required
- `allow_public_view = false, allow_org_view = true`: Requires login + org membership
- `is_active = false`: Returns 404

## UI Integration

The SharePanel (in chat-interface.tsx) provides:
1. **Public link section** — "Create share link" button, copies URL to clipboard
2. **Team sharing section** — Checkboxes for org members, bulk share

Accessed via **Actions → Share...** in the chat header.

## Fixes & Updates (April 2026)

### Middleware Fix
`/share/*` routes added to public paths in `src/middleware.ts` — previously non-authenticated users were redirected to `/login` when visiting share links.

### Auth Fix
Share page (`src/app/share/[token]/page.tsx`) now uses `createAdminClient()` to bypass RLS for anonymous visitors. Security is enforced by the share token lookup + `is_active` check, not by Supabase RLS.

### Share Page Rendering
- Standalone page (outside dashboard layout) — no sidebar, no nav, no chat input
- Read-only message bubbles with tool call badges
- Header with title + date + branding
- Footer with "Powered by Layers"

### Share Types (Clarified)
- **Public** (`allow_public_view = true`) — anyone with link, no auth required
- **Org-only** (`allow_public_view = false`) — checks `org_members` via user-scoped Supabase client

---

## Future Enhancements

- [ ] Share artifacts (not just conversations)
- [ ] Expiring links (set `expires_at`)
- [ ] View count tracking
- [ ] Password-protected shares
- [ ] Embed code (iframe snippet)
- [ ] Share specific message ranges (not full conversation)
- [ ] QR code generation for mobile sharing
