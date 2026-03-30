# Granger -- Full Setup Guide

> Complete instructions for running Granger locally and deploying to production.

---

## 1. Prerequisites

### Required Software

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) or `brew install node` |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker | Latest | [docker.com](https://docker.com) (required for local Supabase) |
| Supabase CLI | Latest | `brew install supabase/tap/supabase` |
| Git | Latest | `brew install git` |

### Accounts Needed

| Service | Purpose | URL |
|---------|---------|-----|
| Vercel | Hosting, crons, edge functions | [vercel.com](https://vercel.com) |
| Supabase | Database, auth, vector search | [supabase.com](https://supabase.com) |
| Discord Developer | Bot for team communication | [discord.com/developers](https://discord.com/developers/applications) |
| Google Cloud | Gmail + Drive OAuth | [console.cloud.google.com](https://console.cloud.google.com) |
| Granola | Meeting transcripts (Business plan) | [granola.ai](https://granola.ai) |
| Linear | Project management | [linear.app](https://linear.app) |
| Notion | Shared workspace docs | [notion.so](https://notion.so) |
| Vercel AI Gateway | Single key for all AI models | [vercel.com/ai-gateway](https://vercel.com/ai-gateway) |

---

## 2. Local Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/mirror-factory/layers-mf.git
cd layers-mf

# 2. Install dependencies
pnpm install

# 3. Start local Supabase (requires Docker running)
supabase start

# 4. Apply all migrations and seed data
pnpm db:reset

# 5. Generate TypeScript types from database schema
pnpm db:types

# 6. Create your local env file
cp .env.example .env.local
# Fill in values (see Section 3 below)

# 7. Start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`.

### Useful Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm db:reset` | Reset local Supabase (runs all migrations + seeds) |
| `pnpm db:types` | Regenerate TypeScript types from DB schema |
| `pnpm eval` | Run all AI eval suites |
| `pnpm eval:retrieval` | Run retrieval quality evals |
| `pnpm eval:agent` | Run agent quality evals |

---

## 3. Environment Variables -- Full Reference

Copy `.env.example` to `.env.local` and fill in every value. Below is a complete reference grouped by service.

### Supabase

```bash
# Local development (supabase start prints these)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...       # Printed by `supabase start`
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # Printed by `supabase start` (server-only, bypasses RLS)
```

After `supabase start`, the CLI prints the anon key and service role key. Copy them directly.

For production, use your Supabase project's keys from the dashboard: Settings > API.

### AI Gateway (single key for all AI models)

```bash
AI_GATEWAY_API_KEY=vck_...                 # Vercel AI Gateway key
```

This single key routes to Claude, GPT, and Gemini models across 3 tiers. Get it from the Vercel AI Gateway dashboard. Each partner can optionally add their own key in `/settings/api-keys` for personal billing.

### Discord Bot

```bash
DISCORD_BOT_TOKEN=...                      # Bot tab > Token (reset to reveal)
DISCORD_PUBLIC_KEY=...                     # General Information > Public Key
DISCORD_APPLICATION_ID=...                 # General Information > Application ID
DISCORD_GUILD_ID=...                       # Right-click your server > Copy Server ID
DISCORD_DIGEST_CHANNEL_ID=...             # Right-click #granger-digest > Copy Channel ID
DISCORD_ALERTS_CHANNEL_ID=...             # Right-click #granger-alerts > Copy Channel ID
```

See Section 4 for full Discord setup walkthrough.

### Granola

```bash
GRANOLA_API_KEY=grn_...                    # Granola Settings > API Keys (requires Business plan)
GRANOLA_WEBHOOK_TOKEN=...                  # Webhook bearer token for inbound events
```

### Google OAuth (Gmail + Drive)

```bash
GOOGLE_CLIENT_ID=...                       # Google Cloud Console > Credentials
GOOGLE_CLIENT_SECRET=...                   # Same credential page
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

For production, add `https://your-app.vercel.app/api/auth/google/callback` as a redirect URI. See Section 5 for full Google setup walkthrough.

### Linear

```bash
# No env var needed -- each partner adds their Personal API Key
# via /settings/api-keys in the web UI.
# The key is stored encrypted in the credentials table.
```

### Notion

```bash
# No env var needed -- the integration token is stored per-org
# in the credentials table via /settings/api-keys.
```

### Cron Security

```bash
CRON_SECRET=...                            # Any random string; Vercel sets this automatically
```

Used to authenticate cron endpoint calls. Vercel injects the `Authorization: Bearer <CRON_SECRET>` header on cron requests.

### Stripe (payments)

```bash
STRIPE_SECRET_KEY=sk_test_...              # Stripe Dashboard > API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Same page (safe for browser)
STRIPE_WEBHOOK_SECRET=whsec_...            # Stripe Dashboard > Webhooks > Signing secret
```

### Nango (legacy -- being replaced by direct APIs)

```bash
NANGO_SECRET_KEY=...                       # Nango secret key (server-only)
NEXT_PUBLIC_NANGO_PUBLIC_KEY=...           # Nango public key (frontend Connect UI)
NANGO_WEBHOOK_SECRET=...                   # Nango webhook HMAC signing secret
```

### Inngest (background jobs)

```bash
INNGEST_EVENT_KEY=...                      # Auto-set by Vercel integration
INNGEST_SIGNING_KEY=...                    # Auto-set by Vercel integration
```

### App URLs

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Dev; https://layers.mirrorfactory.com in prod
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Same as SITE_URL
```

### Webhook Verification

```bash
LINEAR_WEBHOOK_SECRET=...                  # Linear webhook HMAC secret (hex string)
DISCORD_PUBLIC_KEY=...                     # Discord Ed25519 verification (same as above)
```

### Security (optional)

```bash
HEALTH_CHECK_SECRET=...                    # Protect /api/health endpoint
```

---

## 4. Discord Bot Setup (Step-by-Step)

### Create the Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** and name it "Granger"
3. On the **General Information** page:
   - Copy **Application ID** and set as `DISCORD_APPLICATION_ID`
   - Copy **Public Key** and set as `DISCORD_PUBLIC_KEY`

### Configure the Bot

4. Go to the **Bot** tab
5. Click **Reset Token** and copy the token immediately -- set as `DISCORD_BOT_TOKEN`
6. Under **Privileged Gateway Intents**, enable:
   - **MESSAGE CONTENT INTENT** (required to read message text)

### Set Permissions and Invite

7. Go to **OAuth2 > URL Generator**
8. Select scopes: `bot`, `applications.commands`
9. Select bot permissions:
   - Send Messages
   - Read Messages/View Channels
   - Create Public Threads
   - Send Messages in Threads
   - Add Reactions
   - Use Slash Commands
   - Read Message History
10. Copy the generated URL
11. Open it in your browser and add the bot to your Discord server

### Set Up Channels

12. In your Discord server, create two text channels:
    - `#granger-digest` -- morning briefings
    - `#granger-alerts` -- real-time alerts (overdue items, conflicts, new meeting extractions)
13. Right-click `#granger-digest` > **Copy Channel ID** and set as `DISCORD_DIGEST_CHANNEL_ID`
14. Right-click `#granger-alerts` > **Copy Channel ID** and set as `DISCORD_ALERTS_CHANNEL_ID`
15. Right-click the **server name** > **Copy Server ID** and set as `DISCORD_GUILD_ID`

> If "Copy ID" is not visible, enable **Developer Mode** in Discord: User Settings > Advanced > Developer Mode.

### Register Slash Commands

16. Run the registration script locally:

```bash
tsx scripts/register-discord-commands.ts
```

This registers `/ask`, `/status`, `/tasks`, and `/digest` commands with Discord's API.

### Set Interactions Endpoint

17. Back in the Discord Developer Portal, go to **General Information**
18. Set **Interactions Endpoint URL** to:
    - Production: `https://your-app.vercel.app/api/discord/interactions`
    - This must be deployed first -- Discord verifies the endpoint immediately

Discord will POST all slash commands and @mentions to this URL.

---

## 5. Google OAuth Setup (Gmail + Drive)

### Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable these APIs:
   - **Gmail API** (APIs & Services > Library > search "Gmail API" > Enable)
   - **Google Drive API** (same process)

### Create OAuth Credentials

4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Name: "Granger"
8. **Authorized redirect URIs** -- add both:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://your-app.vercel.app/api/auth/google/callback` (production)
9. Copy **Client ID** and set as `GOOGLE_CLIENT_ID`
10. Copy **Client Secret** and set as `GOOGLE_CLIENT_SECRET`

### Configure Consent Screen

11. Go to **OAuth consent screen**
12. User type: **Internal** (if using Google Workspace) or **External** (add test users)
13. Add scopes:
    - `gmail.readonly` -- read email
    - `gmail.compose` -- draft emails
    - `gmail.modify` -- manage labels/read state
    - `drive.readonly` -- read Drive files

### Partner Authorization

Each partner completes their own OAuth flow:

14. Visit `/settings/api-keys` in the Granger web UI
15. Click **Connect Google Account**
16. Complete the Google consent flow
17. The refresh token is stored encrypted in the `credentials` table

Gmail and Drive share the same OAuth token. One consent flow covers both.

---

## 6. API Key Setup per Service

### Granola

1. Open Granola app > Settings > API Keys
2. Click **Generate** (requires Business plan or higher)
3. Copy the key (starts with `grn_`)
4. Add as `GRANOLA_API_KEY` in `.env.local` (org-level shared key)

### Linear

Each partner adds their own Personal API Key:

1. Go to [linear.app](https://linear.app) > Settings > API
2. Click **Personal API Key > Create**
3. Copy the key
4. Paste in Granger web UI at `/settings/api-keys`

### Notion

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New Integration**
3. Name it "Granger", select your workspace
4. Copy the **Internal Integration Token** (starts with `secret_`)
5. Paste in Granger web UI at `/settings/api-keys` (org-level)
6. **Share pages with the integration**: In Notion, open each page/database Granger should access, click the three-dot menu > Connections > Add "Granger". Without this step, the API returns 404 for those pages.

---

## 7. Partner Onboarding

Each partner (Alfonso, Kyle, Bobby) visits `/settings/api-keys` and completes:

1. **Discord User ID**: Right-click your profile in Discord > **Copy User ID**. This links your Discord identity to your Supabase account so Granger knows who is messaging.

2. **AI Gateway Key** (optional): Add a personal Vercel AI Gateway key if you want separate billing. Otherwise, requests fall back to the shared team key.

3. **Service API Keys**: Add personal keys for services that need per-user access:
   - Linear Personal API Key
   - Any other per-user credentials

4. **Google Account**: Click **Connect Google Account** to authorize Gmail + Drive access. This stores an encrypted refresh token scoped to your account only.

---

## 8. Vercel Deployment

### Initial Setup

1. Push the repo to GitHub (if not already)
2. Go to [vercel.com](https://vercel.com) > **Add New Project**
3. Import the `layers-mf` repository
4. Set **Framework Preset** to Next.js
5. Set all environment variables in the Vercel dashboard (Settings > Environment Variables)

### Required Environment Variables in Vercel

Set every variable from Section 3 in the Vercel dashboard. At minimum:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AI_GATEWAY_API_KEY
DISCORD_BOT_TOKEN
DISCORD_PUBLIC_KEY
DISCORD_APPLICATION_ID
DISCORD_GUILD_ID
DISCORD_DIGEST_CHANNEL_ID
DISCORD_ALERTS_CHANNEL_ID
GRANOLA_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI        (set to https://your-app.vercel.app/api/auth/google/callback)
CRON_SECRET
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_APP_URL
```

### Deploy

6. Click **Deploy**
7. After deployment, set the Discord Interactions Endpoint URL to `https://your-domain.vercel.app/api/discord/interactions`
8. Re-register Discord commands pointing to production:

```bash
DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... tsx scripts/register-discord-commands.ts
```

### Verify Crons

Granger relies on 7 cron jobs defined in `vercel.json`:

| Schedule | Path | Purpose |
|----------|------|---------|
| `0 7 * * *` | `/api/inbox/generate` | Generate inbox items |
| `0 7 * * 1-5` | `/api/cron/digest` | Morning digest (weekdays) |
| `0 0 1 * *` | `/api/cron/credit-reset` | Monthly credit reset |
| `0 */20 * * *` | `/api/cron/drive-watch-renewal` | Renew Drive watch channels |
| `0 */2 * * *` | `/api/cron/discord-alerts` | Overdue/conflict alerts |
| `*/15 * * * *` | `/api/cron/ingest` | Poll Granola + process new docs |
| `0 2 * * *` | `/api/cron/synthesis` | Nightly cross-source synthesis |

Verify crons are firing: **Vercel Dashboard > your project > Crons**. Each cron shows its last run time and status.

### Function Timeouts

The following routes have extended timeouts configured in `vercel.json`:

| Route | Max Duration |
|-------|-------------|
| `/api/chat/*` | 60s |
| `/api/ingest/upload` | 30s |
| `/api/integrations/*/sync` | 30s |
| `/api/webhooks/*` | 30s |
| `/api/inbox/generate` | 60s |
| `/api/cron/digest` | 300s (5 min) |
| `/api/cron/synthesis` | 60s |

---

## 9. Troubleshooting

### Supabase won't start
- Make sure Docker is running: `docker info`
- If ports conflict: `supabase stop && supabase start`

### Discord bot not responding
- Verify the Interactions Endpoint URL is set and the app is deployed
- Check Vercel function logs for `/api/discord/interactions`
- Ensure `MESSAGE_CONTENT` intent is enabled in the Developer Portal

### Google OAuth errors
- Confirm redirect URIs match exactly (trailing slashes matter)
- Check that Gmail API and Drive API are enabled in the Cloud Console
- For "access denied": verify the consent screen has the correct scopes

### Crons not firing
- Crons only run in production on Vercel (not locally)
- To test locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest`

### AI Gateway errors
- Verify `AI_GATEWAY_API_KEY` is set and valid
- Check model availability at [vercel.com/ai-gateway/models](https://vercel.com/ai-gateway/models)
