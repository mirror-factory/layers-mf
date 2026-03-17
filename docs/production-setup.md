# Production Setup Checklist

> Comprehensive guide for deploying Layers to production.
> Last Updated: 2026-03-17

---

## Supabase Production (PROD-224)

### Create Project
- [ ] Create production project at [app.supabase.com](https://app.supabase.com)
- [ ] Select region closest to users (e.g., us-east-1)
- [ ] Note project ref and connection string

### Apply Migrations (21 total)

Apply in order via Supabase CLI (`supabase db push`) or the SQL editor:

| # | Migration | Description |
|---|-----------|-------------|
| 1 | `20260305231614_initial_schema.sql` | Core tables: organizations, org_members, integrations, context_items (pgvector), sessions, session_context_links, inbox_items + RLS + `get_user_org_ids()` + `handle_updated_at()` |
| 2 | `20260306003151_org_creation_trigger.sql` | Auto org creation on user signup (`handle_new_user()`) |
| 3 | `20260306020000_search_function.sql` | `search_context_items()` + `search_context_items_text()` |
| 4 | `20260306030000_context_items_source_unique.sql` | Unique constraint on source_id |
| 5 | `20260306100000_relax_source_type.sql` | Relax source_type column |
| 6 | `20260306110000_drop_source_type_check.sql` | Drop source_type check constraint |
| 7 | `20260307000000_agent_runs.sql` | Agent runs tracking table |
| 8 | `20260307100000_kpi_functions.sql` | `get_context_health()`, `get_integration_health()`, `get_agent_metrics()` |
| 9 | `20260308100000_org_invitations.sql` | Org invitations table + `accept_invitation()` + updated `handle_new_user()` |
| 10 | `20260308200000_chat_messages.sql` | Chat messages table |
| 11 | `20260309010000_session_members.sql` | Session members table |
| 12 | `20260309020000_conversations.sql` | Conversations table |
| 13 | `20260309030000_audit_log.sql` | Audit log table |
| 14 | `20260309100000_hybrid_search.sql` | `hybrid_search()` + `hybrid_search_text()` |
| 15 | `20260309110000_action_items.sql` | Action items table + `get_action_items()` |
| 16 | `20260312000000_upsert_dedup.sql` | Upsert deduplication logic |
| 17 | `20260312010000_context_chunks.sql` | Context chunks table |
| 18 | `20260312020000_hybrid_search_chunks.sql` | `hybrid_search_chunks()` |
| 19 | `20260317000000_context_versioning_columns.sql` | Versioning columns on context_items |
| 20 | `20260317010000_context_item_versions.sql` | Context item versions table |
| 21 | `20260317020000_usage_logs.sql` | Usage logs table |

### Verify Database

- [ ] Verify `pgvector` extension is enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)
- [ ] Verify RLS policies are active on all tables (check via Supabase Dashboard > Authentication > Policies)
- [ ] Test RPC functions:
  - `hybrid_search` — vector + full-text search with RRF scoring
  - `hybrid_search_text` — text-only fallback search
  - `hybrid_search_chunks` — chunk-level hybrid search
  - `search_context_items` — vector similarity search
  - `search_context_items_text` — text-only context search
  - `get_context_health` — context freshness/coverage KPIs
  - `get_integration_health` — integration status metrics
  - `get_agent_metrics` — agent run performance stats
  - `get_action_items` — filtered action items query
  - `get_user_org_ids` — RLS helper (returns user's org IDs)
  - `accept_invitation` — org invitation acceptance

### Production Configuration

- [ ] Configure connection pooling (Supavisor) — recommended for serverless
- [ ] Set up database backups (daily, PITR if available)
- [ ] Set up database monitoring alerts
- [ ] Configure auth providers (Email + Google OAuth)
- [ ] Set auth redirect URLs to production domain

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Stripe Production (PROD-225)

### Switch to Live Keys

- [ ] Switch from `sk_test_` / `pk_test_` to `sk_live_` / `pk_live_` in Vercel env vars
- [ ] Create production products and prices in Stripe Dashboard:
  - 100 credits — $9.99
  - 500 credits — $39.99
  - 2,000 credits — $129.99
- [ ] Update price IDs in code if different from test mode

### Webhook Setup

- [ ] Create production webhook endpoint in Stripe Dashboard:
  - URL: `https://layers.mirrorfactory.com/api/webhooks/stripe`
  - Events to subscribe:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
- [ ] Copy webhook signing secret to Vercel env vars

### Testing

- [ ] Test end-to-end: purchase credits -> webhook fires -> credit balance updated
- [ ] Verify Stripe Dashboard shows successful payments
- [ ] Test webhook retry behavior (Stripe retries failed webhooks)

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Inngest Production (PROD-226)

### Vercel Integration

- [ ] Install Inngest Vercel integration from Vercel Marketplace
- [ ] This auto-configures `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

### Configuration

- [ ] Configure concurrency limits: 10 concurrent executions, 3 retries per step
- [ ] Verify the 7-step context processing pipeline:
  1. **fetch** — Download/read source file
  2. **extract** — AI extraction (title, summaries, entities, sentiment)
  3. **chunk** — Intelligent document chunking (parent-child, ~400/1500 tokens)
  4. **embed-chunks** — Generate embeddings for each chunk
  5. **embed-item** — Generate embedding for the full item
  6. **inbox** — Create inbox items (action items, decisions)
  7. **link-sessions** — AI-match content to relevant sessions

### Monitoring

- [ ] Set up Inngest Cloud monitoring dashboard
- [ ] Configure failure alerts (email or Slack)
- [ ] Review function logs for errors

### Testing

- [ ] Upload a file -> verify pipeline completes -> status=ready
- [ ] Check all 7 steps execute successfully in Inngest dashboard
- [ ] Verify embeddings are stored correctly (1536-dim vectors)
- [ ] Verify inbox items are generated
- [ ] Verify session linking works

### Environment Variables

```bash
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

---

## Vercel Deployment

### Project Setup

- [ ] Create Vercel project, link to `mirror-factory/layers-mf` GitHub repo
- [ ] Framework preset: Next.js
- [ ] Root directory: `.` (default)
- [ ] Build command: `pnpm build`
- [ ] Install command: `pnpm install`

### Environment Variables

Set ALL of the following in Vercel Dashboard (Settings > Environment Variables):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
AI_GATEWAY_API_KEY=vck_...

# Nango
NANGO_SECRET_KEY=...
NEXT_PUBLIC_NANGO_PUBLIC_KEY=...       # If using Nango Connect UI
NANGO_WEBHOOK_SECRET=...               # HMAC webhook verification

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Inngest (auto-configured by Vercel integration)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# App
NEXT_PUBLIC_SITE_URL=https://layers.mirrorfactory.com
NEXT_PUBLIC_APP_URL=https://layers.mirrorfactory.com

# Webhooks
LINEAR_WEBHOOK_SECRET=...              # Linear webhook HMAC
DISCORD_PUBLIC_KEY=...                 # Discord Ed25519 public key
GRANOLA_WEBHOOK_TOKEN=...              # Granola webhook token

# Security
HEALTH_CHECK_SECRET=...                # Optional: protect /api/health
CRON_SECRET=...                        # Vercel cron job auth (auto-set by Vercel)
```

### Deployment Configuration

- [ ] Set up preview deployments on PRs (enabled by default)
- [ ] Production deploy on push to `main` branch
- [ ] Configure custom domain: `layers.mirrorfactory.com`
- [ ] Set up Cloudflare DNS: CNAME record pointing to `cname.vercel-dns.com`
- [ ] Verify SSL certificate is provisioned

### Function Configuration

- [ ] Set `maxDuration` for long-running API routes (see `vercel.json`)
- [ ] Verify cron job for inbox generation: `0 7 * * *` on `/api/inbox/generate`

---

## Nango Production

- [ ] Configure production callback URLs in Nango Dashboard
- [ ] Set `NANGO_SECRET_KEY` for production environment
- [ ] Update webhook URL to: `https://layers.mirrorfactory.com/api/webhooks/nango`
- [ ] Configure OAuth apps for each integration provider:
  - Google Drive: Update authorized redirect URIs
  - Linear: Update webhook URL
  - Discord: Update interactions endpoint URL
  - Granola: Update webhook URL
- [ ] Verify all integration connection flows work on production domain

---

## Post-Deployment Checklist

### Smoke Tests

- [ ] All API routes respond (hit `/api/health`)
- [ ] Auth flow: signup with email -> verify email -> login
- [ ] Auth flow: Google OAuth login
- [ ] Auth flow: forgot password -> reset password
- [ ] Onboarding flow completes (4 steps)

### Core Features

- [ ] File upload -> Inngest pipeline -> status changes to `ready`
- [ ] Chat: send message -> get AI response with source citations
- [ ] Chat: tool calls (search_context, get_document) execute correctly
- [ ] Context library: filters, pagination, bulk operations work
- [ ] Sessions: create, add context, scoped chat works
- [ ] Inbox: items appear, can mark done/dismiss
- [ ] Actions: action items tracked and updatable

### Integrations

- [ ] Google Drive: connect -> sync files -> items appear in context library
- [ ] Linear: connect -> sync issues -> items appear
- [ ] Discord: connect -> sync messages -> items appear
- [ ] Granola: webhook delivers meeting transcripts

### Billing

- [ ] Credit balance displays correctly
- [ ] Credit purchase: select package -> Stripe checkout -> webhook -> balance updated
- [ ] Usage logging: AI calls deduct credits and log usage

### Team

- [ ] Invite team member -> email sent -> accept invitation -> member added
- [ ] Role-based access works (admin vs member)
- [ ] Audit log records actions

### Performance

- [ ] Pages load under 3s on production
- [ ] No console errors in browser
- [ ] API response times under 500ms (excluding AI calls)
- [ ] Inngest pipeline completes within 60s for typical documents
