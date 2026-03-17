# Layers P2-P3 Execution Plan

> **Created:** 2026-03-15
> **CTO:** Alfonso Morales (reviews all output)
> **Execution Lead:** Claude (dispatches work, maintains docs/tests, updates Linear)
> **Timeline:** Weeks 7-20 (March 17 – June 5, 2026)
> **Team:** 4 agents (PM + 3 Dev Agents)

---

## Agent Team

| Agent | Role | Focus | Model | tmux Pane |
|-------|------|-------|-------|-----------|
| **PM** | Orchestration | Linear updates, code review, QA verification, test URLs | Haiku | Pane 0 |
| **Dev 1** | Backend | APIs, pipeline, Inngest, Supabase, Stripe, credit system | Sonnet | Pane 1 |
| **Dev 2** | Frontend | Pages, components, AI Elements, UX, responsive design | Sonnet | Pane 2 |
| **Dev 3** | Integrations + QA | Nango, webhooks, E2E tests, evals, monitoring | Sonnet | Pane 3 |

### Dynamic Documentation Protocol

After every sprint, PM agent will:
1. Update `docs/dev-status.md` with completed work
2. Update `docs/plans/2026-03-15-p2-p3-execution-plan.md` with status checkmarks
3. Run full test suite and record results
4. Update Linear issues with commit refs and test evidence
5. Provide CTO review summary with live test URLs

### Test Maintenance Protocol

- **Dev 1**: Unit tests for every new API route and lib module
- **Dev 2**: Component tests where applicable, visual QA screenshots
- **Dev 3**: E2E tests for every new user flow, eval suite updates
- **PM**: Runs `pnpm test` + `pnpm typecheck` + `npx playwright test` after each sprint

---

## Sprint Overview

| Sprint | Dates | Theme | Issues | Key Deliverable |
|--------|-------|-------|--------|-----------------|
| **4** | Mar 17-28 | Production Readiness + Credit Enforcement | 16 | Deploy to Vercel, credits deducted on AI calls |
| **5** | Mar 31-Apr 11 | Integrations Expansion + Daily Digest | 15 | Slack/Notion sync, morning digest email |
| **6** | Apr 14-25 | Session Agents + Monitoring | 14 | Proactive session agents, Sentry, uptime checks |
| **7** | Apr 28-May 9 | Ditto Personalization | 15 | Per-user AI agent with learned preferences |
| **8** | May 12-23 | Self-Service + External Teams | 14 | Public signup, onboarding, first external team |
| **9** | May 26-Jun 5 | Canvas UI + Polish | 12 | Easel workspace, final QA, launch prep |

**Total: 86 issues across 6 sprints**

---

## Sprint 4: Production Readiness + Credit Enforcement

**Dates:** March 17-28, 2026
**Goal:** Layers running in production on Vercel with credit deduction on every AI call.
**Success Metric:** Team of 3 using production URL daily. Credits deducted accurately.

### Dev 1 (Backend) — 6 issues

**PROD-S4-01: Credit deduction middleware**
- Type: Feature | Priority: Urgent | Labels: Backend
- Create `src/lib/credits.ts` with `deductCredits()` and `checkCredits()` middleware
- Wire into `/api/chat`, `/api/context/process`, `/api/inbox/generate`
- Different costs per operation: chat (1 credit), extraction (2), embedding (0.5), inbox gen (1)
- Graceful error when credits exhausted (402 Payment Required)
- Unit tests for deduction logic, edge cases (0 balance, concurrent deductions)
- Files: `src/lib/credits.ts`, `src/app/api/chat/route.ts`, `src/app/api/context/process/route.ts`

**PROD-S4-02: Usage logging on every AI call**
- Type: Feature | Priority: High | Labels: Backend
- Insert into `usage_logs` table on every AI SDK call (model, tokens, cost, credits_used)
- Wrap AI Gateway calls with usage tracking helper
- Aggregate usage by day/week/month for billing display
- Unit tests for logging, aggregation queries
- Files: `src/lib/ai/usage.ts`, modify `src/lib/ai/config.ts`

**PROD-S4-03: Production Supabase migration**
- Type: Task | Priority: Urgent | Labels: Backend
- Create production Supabase project
- Apply all 18 migrations
- Configure RLS policies, enable pgvector extension
- Set up connection pooling (Supavisor)
- Verify all RPC functions work in production
- Document production env vars

**PROD-S4-04: Stripe production configuration**
- Type: Task | Priority: High | Labels: Backend
- Switch from test to live Stripe keys
- Create production webhook endpoint in Stripe dashboard
- Configure webhook events (checkout.session.completed, subscription.*, invoice.*)
- Test end-to-end purchase flow with real Stripe Checkout
- Add idempotency keys to webhook handler

**PROD-S4-05: Inngest production setup**
- Type: Task | Priority: High | Labels: Backend
- Deploy Inngest to production (Vercel integration)
- Configure concurrency limits for production load
- Set up Inngest dashboard for monitoring
- Test pipeline execution in production environment
- Files: `src/app/api/inngest/route.ts`, Inngest Cloud config

**PROD-S4-06: API rate limiting per-org**
- Type: Feature | Priority: Normal | Labels: Backend
- Upgrade rate limiter from per-user to per-org with configurable limits
- Tier-based limits: free (50 req/hr), starter (500), pro (5000)
- Rate limit headers in responses (X-RateLimit-Remaining, X-RateLimit-Reset)
- Unit tests for tier-based limiting
- Files: `src/lib/rate-limit.ts`

### Dev 2 (Frontend) — 5 issues

**PROD-S4-07: Usage history UI in billing**
- Type: Feature | Priority: High | Labels: Frontend
- Add usage table to `/settings/billing` showing recent AI operations
- Columns: date, operation type, model, tokens, credits used
- Daily/weekly/monthly aggregation toggle
- Bar chart of credit usage over time
- Files: `src/components/billing-settings.tsx`, new `src/components/usage-chart.tsx`

**PROD-S4-08: Credit balance in sidebar + low balance warning**
- Type: Feature | Priority: Normal | Labels: Frontend
- Show credit balance in sidebar nav footer
- Yellow warning badge when < 50 credits remaining
- Red warning + toast notification when < 10 credits
- "Upgrade" link to billing page
- Files: `src/components/sidebar-nav.tsx`

**PROD-S4-09: Production error pages + offline handling**
- Type: Feature | Priority: Normal | Labels: Frontend
- Custom 500 error page with retry
- Network offline detection with banner
- API timeout handling with user feedback
- Proper loading states during Vercel cold starts
- Files: `src/app/error.tsx`, `src/app/not-found.tsx`

**PROD-S4-10: SEO + meta tags + OG images**
- Type: Task | Priority: Normal | Labels: Frontend
- Add metadata to layout.tsx (title, description, OG image)
- Dynamic titles per page
- Favicon and apple-touch-icon
- Files: `src/app/layout.tsx`, `public/`

**PROD-S4-11: Mobile responsive polish**
- Type: Improvement | Priority: Normal | Labels: Frontend
- Audit all pages on mobile (390px, 768px)
- Fix chat interface on mobile (input bar, message layout)
- Fix context library filters on mobile
- Fix session workspace sidebar on mobile
- Test with Playwright on mobile viewport

### Dev 3 (Integrations + QA) — 5 issues

**PROD-S4-12: Vercel deployment + CI/CD**
- Type: Task | Priority: Urgent | Labels: Backend
- Set up Vercel project, link to GitHub repo
- Configure all environment variables in Vercel dashboard
- Set up preview deployments on PRs
- Production deploy on push to main
- Verify Cloudflare DNS for custom domain
- Smoke test all routes post-deploy

**PROD-S4-13: Nango webhook secret verification**
- Type: Bug | Priority: High | Labels: Backend
- Set NANGO_WEBHOOK_SECRET in env
- Add HMAC verification to `/api/webhooks/nango`
- Reject unverified webhook payloads
- Unit test for signature verification
- Files: `src/app/api/webhooks/nango/route.ts`

**PROD-S4-14: E2E billing flow test**
- Type: Task | Priority: High | Labels: Frontend
- Playwright test: navigate to billing → see balance → click purchase
- Mock Stripe Checkout redirect (can't test real Stripe in E2E)
- Test credit balance display updates after purchase
- Test low-balance warning states
- Files: `e2e/billing.spec.ts`

**PROD-S4-15: E2E production smoke tests**
- Type: Task | Priority: High | Labels: Frontend
- Playwright tests against production URL
- Auth flow (login, signup) on production
- Dashboard loads with real data
- Chat sends message and gets response
- Context library displays items
- Files: `e2e/production-smoke.spec.ts`

**PROD-S4-16: Webhook idempotency for all providers**
- Type: Feature | Priority: Normal | Labels: Backend
- Add idempotency tracking table or cache
- Check event ID before processing (Stripe, Linear, Discord, Nango)
- Prevent duplicate processing on webhook retries
- Unit tests for dedup logic
- Files: new `src/lib/webhook-dedup.ts`

---

## Sprint 5: Integrations Expansion + Daily Digest

**Dates:** March 31 - April 11, 2026
**Goal:** Slack and Notion connected. Morning digest delivered via email.
**Success Metric:** 3 new data sources active. Team receives daily email digest.

### Dev 1 (Backend) — 5 issues

**PROD-S5-01: Daily digest email generation**
- Type: Feature | Priority: Urgent | Labels: Backend
- Vercel Cron at 7:00 AM → generate digest per user
- Uses existing `generateInboxForUser()` + formats as email HTML
- Template: priority items, new context summary, overdue actions
- Stores digest history for deduplication
- Files: `src/app/api/cron/digest/route.ts`, `src/lib/email/digest-template.ts`

**PROD-S5-02: Email delivery via Resend**
- Type: Feature | Priority: Urgent | Labels: Backend
- Install `resend` package
- Configure Resend API key
- Send digest emails with HTML template
- Unsubscribe link per user
- Delivery tracking (sent, opened, clicked)
- Files: `src/lib/email/send.ts`

**PROD-S5-03: Notification preferences API**
- Type: Feature | Priority: High | Labels: Backend
- `GET/PATCH /api/settings/notifications` per user
- Settings: digest_enabled, digest_time, email_on_mention, email_on_action_item
- Store in user_metadata or new notifications_preferences table
- Migration for preferences table
- Files: new `supabase/migrations/..._notification_preferences.sql`

**PROD-S5-04: Slack integration backend**
- Type: Feature | Priority: High | Labels: Backend
- Nango integration for Slack OAuth
- Webhook receiver for Slack events (messages, reactions, threads)
- Message batching into context items (aggregate by channel/thread)
- Channel selection UI data (list user's channels)
- Files: `src/lib/integrations/slack.ts`, `src/app/api/webhooks/slack/route.ts`

**PROD-S5-05: Notion integration backend**
- Type: Feature | Priority: High | Labels: Backend
- Nango integration for Notion OAuth
- Page and database sync via Notion API
- Incremental sync (track last_edited_time)
- Content extraction from Notion blocks → plain text
- Files: `src/lib/integrations/notion.ts`, `src/app/api/integrations/notion/sync/route.ts`

### Dev 2 (Frontend) — 5 issues

**PROD-S5-06: Notification preferences UI**
- Type: Feature | Priority: High | Labels: Frontend
- New `/settings/notifications` page
- Toggle switches: daily digest, mention alerts, action item alerts
- Digest time picker (dropdown: 6 AM, 7 AM, 8 AM, 9 AM)
- Add to sidebar nav
- Files: `src/app/(dashboard)/settings/notifications/page.tsx`

**PROD-S5-07: Slack integration card + connect UI**
- Type: Feature | Priority: High | Labels: Frontend
- Slack card on `/integrations` page with channel selector
- Show connected channels after OAuth
- Sync status indicators
- Files: `src/app/(dashboard)/integrations/page.tsx`

**PROD-S5-08: Notion integration card + connect UI**
- Type: Feature | Priority: High | Labels: Frontend
- Notion card on `/integrations` page with page/database selector
- Show synced pages after OAuth
- Sync status indicators

**PROD-S5-09: Digest email preview in app**
- Type: Feature | Priority: Normal | Labels: Frontend
- "Preview today's digest" button on inbox page
- Renders same template as email, in-app
- "Send now" button for manual trigger
- Files: `src/components/digest-preview.tsx`

**PROD-S5-10: Context library source badges for Slack + Notion**
- Type: Improvement | Priority: Normal | Labels: Frontend
- Add Slack and Notion icons to source badge component
- Color coding consistent with brand colors
- Filter options in context library for new sources
- Files: `src/components/context-library.tsx`, `src/components/chat/source-badge.tsx`

### Dev 3 (Integrations + QA) — 5 issues

**PROD-S5-11: Slack integration E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Mock Nango OAuth flow for Slack
- Verify integration card renders, connect button works
- Test webhook payload processing
- Files: `e2e/integrations-slack.spec.ts`

**PROD-S5-12: Notion integration E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Mock Nango OAuth flow for Notion
- Verify page sync creates context items
- Test incremental sync behavior
- Files: `e2e/integrations-notion.spec.ts`

**PROD-S5-13: Email delivery integration test**
- Type: Task | Priority: High | Labels: Backend
- Test digest generation with seeded data
- Verify email template renders correctly
- Test unsubscribe flow
- Mock Resend API for CI
- Files: `src/lib/email/__tests__/digest.test.ts`

**PROD-S5-14: Extraction eval update — Slack + Notion fixtures**
- Type: Task | Priority: Normal | Labels: Backend
- Add 3 Slack message fixtures + expected extractions
- Add 3 Notion page fixtures + expected extractions
- Update extraction eval baseline scores
- Files: `src/lib/evals/fixtures/`

**PROD-S5-15: Webhook health dashboard**
- Type: Feature | Priority: Normal | Labels: Frontend
- Show webhook delivery stats on analytics page
- Per-provider: success/failure count, last received, avg latency
- Alert when a provider hasn't sent webhooks in 24h
- Files: `src/app/(dashboard)/analytics/page.tsx`

---

## Sprint 6: Session Agents + Monitoring

**Dates:** April 14-25, 2026
**Goal:** Sessions have proactive agents. Production monitoring in place.
**Success Metric:** Session agents surface new relevant content within 5 minutes.

### Dev 1 (Backend) — 5 issues

**PROD-S6-01: Session agent polling Inngest function**
- Type: Feature | Priority: Urgent | Labels: Backend
- Inngest cron function: every 15 min, check each active session for new linked content
- Generate session summary delta ("3 new items since your last visit")
- Create inbox items for session members when relevant content arrives
- Configurable polling interval per session (agentConfig JSON)
- Files: `src/lib/inngest/functions/session-agent.ts`

**PROD-S6-02: Session agent insight generation**
- Type: Feature | Priority: High | Labels: Backend
- When new content links to a session, agent generates insight
- `generateObject()` with InsightSchema: cross-source connections, contradictions, action items
- Store insights in new `session_insights` table
- Migration for session_insights
- Files: new `src/lib/pipeline/session-insights.ts`

**PROD-S6-03: Cross-source connection finder**
- Type: Feature | Priority: High | Labels: Backend
- Agent tool that finds connections between items from different sources
- "Meeting decision X contradicts Linear issue Y"
- "Google Doc mentions deadline that doesn't match Linear due date"
- Uses embedding similarity + entity overlap detection
- Files: `src/lib/ai/cross-source.ts`

**PROD-S6-04: Sentry error tracking integration**
- Type: Task | Priority: High | Labels: Backend
- Install `@sentry/nextjs`
- Configure for both client and server
- Custom error boundaries that report to Sentry
- Source maps upload on deploy
- Files: `sentry.client.config.ts`, `sentry.server.config.ts`, `next.config.mjs`

**PROD-S6-05: Health check cron + uptime monitoring**
- Type: Task | Priority: Normal | Labels: Backend
- Vercel Cron every 5 min → hit `/api/health` → log result
- Alert via ntfy if health check fails
- Track uptime percentage
- External monitoring via UptimeRobot or Healthchecks.io
- Files: `src/app/api/cron/health/route.ts`

### Dev 2 (Frontend) — 5 issues

**PROD-S6-06: Session insights panel**
- Type: Feature | Priority: High | Labels: Frontend
- Show AI-generated insights in session workspace sidebar
- "New since your last visit" section with delta summary
- Cross-source connection cards with source badges
- Dismiss/pin individual insights
- Files: `src/components/session-workspace.tsx`, new `src/components/session-insights.tsx`

**PROD-S6-07: Session agent status indicator**
- Type: Feature | Priority: Normal | Labels: Frontend
- "Agent active" / "Agent paused" badge on session cards
- Last agent run timestamp
- "Run agent now" manual trigger button
- Agent activity log (expandable)
- Files: `src/components/sessions-list.tsx`

**PROD-S6-08: Analytics — agent performance dashboard**
- Type: Feature | Priority: Normal | Labels: Frontend
- Agent runs per day chart
- Average response time trend
- Tool usage breakdown (search vs get_document)
- Error rate over time
- Files: `src/app/(dashboard)/analytics/page.tsx`

**PROD-S6-09: Inbox improvements — grouping + batch actions**
- Type: Improvement | Priority: Normal | Labels: Frontend
- Group inbox items by source or session
- Batch mark-as-read, batch dismiss
- "Mark all as read" button
- Unread count badge in sidebar
- Files: `src/components/inbox-list.tsx`, `src/components/sidebar-nav.tsx`

**PROD-S6-10: Context item detail — entity visualization**
- Type: Feature | Priority: Normal | Labels: Frontend
- Show extracted entities as interactive chips on context detail page
- Click person → filter by that person across library
- Click topic → search for related content
- Timeline view of extracted dates
- Files: `src/app/(dashboard)/context/[id]/page.tsx`

### Dev 3 (Integrations + QA) — 4 issues

**PROD-S6-11: Session agent E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Test: create session → link content → verify insight generated
- Mock Inngest function execution
- Verify insight appears in session workspace
- Files: `e2e/session-agent.spec.ts`

**PROD-S6-12: Load testing — chat + search endpoints**
- Type: Task | Priority: High | Labels: Backend
- Use k6 or artillery for load testing
- Benchmark: 50 concurrent chat requests
- Benchmark: 100 concurrent search queries
- Document baseline p50/p95/p99 latencies
- Files: `tests/load/chat.k6.js`, `tests/load/search.k6.js`

**PROD-S6-13: Retrieval eval update — cross-source queries**
- Type: Task | Priority: Normal | Labels: Backend
- Add eval queries that span multiple sources
- "What did we discuss about X in the meeting AND the Linear issue?"
- Measure cross-source retrieval quality
- Files: `src/lib/evals/retrieval.eval.ts`

**PROD-S6-14: Production monitoring dashboard**
- Type: Task | Priority: Normal | Labels: Backend
- Vercel Analytics integration
- Key metrics: response time, error rate, function execution time
- Sentry dashboard with alert rules
- Document monitoring runbook
- Files: `docs/monitoring-runbook.md`

---

## Sprint 7: Ditto Personalization

**Dates:** April 28 - May 9, 2026
**Goal:** Each user has a personal AI agent that learns their preferences.
**Success Metric:** Ditto suggests relevant content before users search for it.

### Dev 1 (Backend) — 5 issues

**PROD-S7-01: User preference learning system**
- Type: Feature | Priority: Urgent | Labels: Backend
- Track user interactions: what they search, what they click, what they dismiss
- Store interaction history in `user_interactions` table
- Build preference vector from interaction patterns
- Migration for user_interactions + user_preferences tables
- Files: `src/lib/ditto/preferences.ts`, new migration

**PROD-S7-02: Ditto profile generation**
- Type: Feature | Priority: Urgent | Labels: Backend
- Weekly Inngest cron: analyze user interactions → generate Ditto profile
- `generateObject()` with DittoProfileSchema: interests, working_hours, communication_style, priority_topics
- Profile informs inbox generation and search ranking
- Files: `src/lib/ditto/profile.ts`, `src/lib/inngest/functions/ditto-profile.ts`

**PROD-S7-03: Personalized inbox ranking**
- Type: Feature | Priority: High | Labels: Backend
- Modify inbox generation to factor in Ditto profile
- User who clicks Linear issues often → prioritize Linear content
- User who dismisses meeting notes → lower priority for transcripts
- A/B test: personalized vs generic ranking
- Files: `src/lib/inbox/generate.ts`

**PROD-S7-04: Personalized search boost**
- Type: Feature | Priority: High | Labels: Backend
- Boost search results matching user's preference vector
- Recent interactions increase relevance score
- Files: `src/lib/db/search.ts`

**PROD-S7-05: Ditto API endpoints**
- Type: Feature | Priority: Normal | Labels: Backend
- `GET /api/ditto/profile` — current user's Ditto profile
- `PATCH /api/ditto/preferences` — manual preference overrides
- `GET /api/ditto/suggestions` — proactive content suggestions
- Files: `src/app/api/ditto/`

### Dev 2 (Frontend) — 5 issues

**PROD-S7-06: Ditto profile page**
- Type: Feature | Priority: High | Labels: Frontend
- New `/ditto` page showing user's AI profile
- Interest tags, communication style, priority topics
- Manual override controls (toggle interests on/off)
- "Reset profile" button
- Files: `src/app/(dashboard)/ditto/page.tsx`

**PROD-S7-07: Ditto suggestions widget**
- Type: Feature | Priority: High | Labels: Frontend
- "For You" section on home dashboard
- Cards: "Based on your interest in X, you might want to see Y"
- Dismiss or save suggestions (feeds back into preference learning)
- Files: `src/app/(dashboard)/page.tsx`, new `src/components/ditto-suggestions.tsx`

**PROD-S7-08: Chat personality customization**
- Type: Feature | Priority: Normal | Labels: Frontend
- Settings page: chat tone (formal/casual), detail level (brief/detailed), proactive suggestions (on/off)
- Ditto profile influences system prompt in chat
- Files: `src/app/(dashboard)/settings/ditto/page.tsx`

**PROD-S7-09: Interaction tracking UI hooks**
- Type: Feature | Priority: Normal | Labels: Frontend
- Track: search queries, clicked items, dismissed inbox, time spent on pages
- Non-blocking analytics events via `navigator.sendBeacon`
- Privacy notice in settings
- Files: `src/lib/ditto/track.ts`

**PROD-S7-10: Ditto onboarding step**
- Type: Improvement | Priority: Normal | Labels: Frontend
- Add optional step to onboarding: "Tell Ditto about yourself"
- Quick interest picker (checkboxes: engineering, design, product, sales, etc.)
- Working hours selector
- Files: `src/app/(onboarding)/onboarding/ditto-setup/page.tsx`

### Dev 3 (Integrations + QA) — 5 issues

**PROD-S7-11: Ditto profile E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Test: new user → interact with content → verify profile generates
- Test: manual preference override → verify search results change
- Files: `e2e/ditto.spec.ts`

**PROD-S7-12: Preference learning eval suite**
- Type: Task | Priority: High | Labels: Backend
- Eval: simulate 50 interactions → verify profile reflects patterns
- Eval: personalized ranking improves relevance over generic
- Measure: personalized MRR vs baseline MRR
- Files: `src/lib/evals/personalization.eval.ts`

**PROD-S7-13: Privacy audit — interaction data**
- Type: Task | Priority: High | Labels: Backend
- Audit all tracked data for PII exposure
- Ensure interaction data is org-scoped (no cross-org leakage)
- Add data deletion endpoint (`DELETE /api/ditto/data`)
- Document data retention policy

**PROD-S7-14: Agent specialization templates — design**
- Type: Research | Priority: Normal | Labels: Backend
- Design template schema for specialized agents
- Research: what templates would be most valuable?
- Candidates: sales call analyzer, sprint retro summarizer, client onboarding
- Write design doc: `docs/plans/agent-templates-design.md`

**PROD-S7-15: Full regression E2E suite**
- Type: Task | Priority: Normal | Labels: Frontend
- Run complete E2E suite on production
- Fix any regressions from Sprint 4-7
- Update test fixtures for new features
- Files: `e2e/`

---

## Sprint 8: Self-Service + External Teams

**Dates:** May 12-23, 2026
**Goal:** External teams can sign up and use Layers without manual onboarding.
**Success Metric:** First external team signs up and reaches "active use" within 48h.

### Dev 1 (Backend) — 5 issues

**PROD-S8-01: Public signup with plan selection**
- Type: Feature | Priority: Urgent | Labels: Backend
- Modify signup flow to include plan selection (Free / Starter / Pro)
- Create Stripe Customer on signup
- Set initial credit allocation based on plan
- Free: 50 credits/month, Starter: 500, Pro: 5000
- Files: `src/app/(auth)/signup/page.tsx`, `src/app/api/auth/`

**PROD-S8-02: Subscription management API**
- Type: Feature | Priority: Urgent | Labels: Backend
- `POST /api/billing/subscribe` — create Stripe subscription
- `PATCH /api/billing/subscription` — upgrade/downgrade plan
- `DELETE /api/billing/subscription` — cancel
- Proration handling on plan changes
- Files: `src/app/api/billing/subscription/route.ts`

**PROD-S8-03: Monthly credit reset cron**
- Type: Feature | Priority: High | Labels: Backend
- Vercel Cron: 1st of month → reset credits based on plan tier
- Carry over unused credits (up to 2x monthly allocation)
- Log reset in audit trail
- Files: `src/app/api/cron/credit-reset/route.ts`

**PROD-S8-04: Organization settings API**
- Type: Feature | Priority: High | Labels: Backend
- `GET/PATCH /api/settings/org` — org name, slug, billing email
- `DELETE /api/settings/org` — delete org (owner only, requires confirmation)
- Data export before deletion
- Files: `src/app/api/settings/org/route.ts`

**PROD-S8-05: API key management**
- Type: Feature | Priority: Normal | Labels: Backend
- Generate/revoke API keys for org
- API key auth as alternative to session auth for integrations
- Rate limiting per API key
- Files: `src/app/api/settings/api-keys/route.ts`

### Dev 2 (Frontend) — 5 issues

**PROD-S8-06: Plan selection page**
- Type: Feature | Priority: Urgent | Labels: Frontend
- Pricing page with 3 tiers (Free / Starter / Pro)
- Feature comparison table
- "Start free" and "Subscribe" CTAs
- Stripe Checkout redirect for paid plans
- Files: `src/app/(auth)/pricing/page.tsx`

**PROD-S8-07: Subscription management UI**
- Type: Feature | Priority: High | Labels: Frontend
- Current plan display in billing settings
- Upgrade/downgrade buttons with proration preview
- Cancel subscription flow with confirmation
- Next billing date and invoice history
- Files: `src/components/billing-settings.tsx`

**PROD-S8-08: Organization settings page**
- Type: Feature | Priority: High | Labels: Frontend
- `/settings/org` — edit org name, slug
- Danger zone: delete org with confirmation modal
- Billing email management
- Files: `src/app/(dashboard)/settings/org/page.tsx`

**PROD-S8-09: API keys management page**
- Type: Feature | Priority: Normal | Labels: Frontend
- `/settings/api-keys` — generate, copy, revoke keys
- Show masked key value (only visible once on creation)
- Last used timestamp per key
- Files: `src/app/(dashboard)/settings/api-keys/page.tsx`

**PROD-S8-10: Landing page / marketing page**
- Type: Feature | Priority: Normal | Labels: Frontend
- Public landing page at `/` for unauthenticated users
- Hero section, feature highlights, pricing preview, CTA
- Redirect to dashboard if already logged in
- Files: `src/app/page.tsx`

### Dev 3 (Integrations + QA) — 4 issues

**PROD-S8-11: Signup → active use E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Full flow: signup → plan select → onboarding → upload file → chat → verify
- Test free tier credit limits
- Test upgrade flow
- Files: `e2e/self-service.spec.ts`

**PROD-S8-12: Subscription lifecycle E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Test: subscribe → use credits → upgrade → cancel
- Mock Stripe interactions
- Verify credit resets work correctly

**PROD-S8-13: Security audit — multi-tenant**
- Type: Task | Priority: Urgent | Labels: Backend
- Verify RLS on all new tables (notification_preferences, user_interactions, session_insights, api_keys)
- Penetration test: can user A see user B's data?
- Test API key scope isolation
- Document security model

**PROD-S8-14: Performance benchmark update**
- Type: Task | Priority: Normal | Labels: Backend
- Re-run load tests with production data volume
- Compare against Sprint 6 baselines
- Identify and address any degradation
- Update `docs/performance-baselines.md`

---

## Sprint 9: Canvas UI + Polish

**Dates:** May 26 - June 5, 2026
**Goal:** Canvas workspace for spatial content exploration. Platform polished for external use.
**Success Metric:** 3-5 external teams actively using Layers.

### Dev 1 (Backend) — 4 issues

**PROD-S9-01: Canvas data model**
- Type: Feature | Priority: High | Labels: Backend
- Canvas = visual workspace with positioned context items
- Migration: `canvases` table (org_id, name, layout JSON)
- `canvas_items` table (canvas_id, context_item_id, x, y, width, height, style)
- CRUD API: `/api/canvases`, `/api/canvases/[id]/items`
- Files: new migration, `src/app/api/canvases/`

**PROD-S9-02: Canvas agent — auto-layout**
- Type: Feature | Priority: Normal | Labels: Backend
- Agent that arranges canvas items by topic clusters
- Uses embedding similarity to group related items
- Force-directed layout algorithm for positioning
- Files: `src/lib/ai/canvas-layout.ts`

**PROD-S9-03: Export system — PDF + Markdown**
- Type: Feature | Priority: Normal | Labels: Backend
- Export context items, sessions, or canvases as PDF
- Export as Markdown for cross-tool compatibility
- Batch export with ZIP download
- Files: `src/app/api/export/route.ts`

**PROD-S9-04: Webhook delivery dashboard API**
- Type: Improvement | Priority: Normal | Labels: Backend
- Track webhook delivery attempts, failures, retries
- `/api/admin/webhooks` — delivery stats per provider
- Auto-disable failed webhooks after 10 consecutive failures
- Files: `src/app/api/admin/webhooks/route.ts`

### Dev 2 (Frontend) — 4 issues

**PROD-S9-05: Canvas workspace UI**
- Type: Feature | Priority: High | Labels: Frontend
- `/canvas` page with infinite pan/zoom workspace
- Drag context items from library onto canvas
- Resize and reposition items
- Draw connections between items
- Minimap for navigation
- Files: `src/app/(dashboard)/canvas/page.tsx`, `src/components/canvas/`

**PROD-S9-06: Canvas item cards**
- Type: Feature | Priority: High | Labels: Frontend
- Rich cards showing title, source badge, summary snippet
- Expand in-place to see full content
- Quick actions: open detail, link to session, delete
- Connection lines between related items
- Files: `src/components/canvas/canvas-item.tsx`

**PROD-S9-07: Final UX polish pass**
- Type: Improvement | Priority: High | Labels: Frontend
- Audit every page for consistency (spacing, typography, color)
- Empty states for all lists (context, sessions, inbox, actions)
- Keyboard shortcuts reference panel
- Accessibility audit (ARIA labels, focus management, contrast)
- Files: multiple component files

**PROD-S9-08: Onboarding improvements from user feedback**
- Type: Improvement | Priority: Normal | Labels: Frontend
- Collect feedback from first external teams
- Fix top 3 friction points in onboarding
- Add tooltips / guided tour for complex features
- Files: `src/app/(onboarding)/`

### Dev 3 (Integrations + QA) — 4 issues

**PROD-S9-09: Canvas E2E test**
- Type: Task | Priority: High | Labels: Frontend
- Test: create canvas → add items → drag → resize → save
- Test: auto-layout agent arranges items
- Files: `e2e/canvas.spec.ts`

**PROD-S9-10: Full platform E2E regression**
- Type: Task | Priority: Urgent | Labels: Frontend
- Complete E2E test covering every feature
- Run against production with test account
- Screenshot comparison for visual regression
- Fix all failures before launch

**PROD-S9-11: Documentation — user guide**
- Type: Task | Priority: High | Labels: Frontend
- Write user-facing documentation
- Getting started guide
- Feature walkthroughs with screenshots
- FAQ / troubleshooting
- Files: `docs/user-guide/`

**PROD-S9-12: Launch checklist**
- Type: Task | Priority: Urgent | Labels: Backend
- Security audit complete
- Performance benchmarks documented
- Monitoring + alerting active
- Backup procedures verified
- Incident response runbook written
- All E2E tests green on production
- Files: `docs/launch-checklist.md`

---

## P4 Backlog (Post-Launch, Unscheduled)

These are tracked but not scheduled into sprints:

- Ditto as primary interface (conversational entry point)
- Integration marketplace (premium agent templates)
- React Three Fiber canvas (3D spatial exploration)
- Gmail integration via Nango
- Calendar integration (Google Calendar, Outlook)
- Mobile app (Expo/React Native)
- Webhooks outbound (notify external systems)
- Custom agent builder (no-code agent creation)
- Team analytics (who contributes what, collaboration patterns)
- Advanced RBAC (custom roles, permission sets)

---

## Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| **P2 End (Sprint 6)** | Daily active users (internal) | 3/3 team members |
| **P2 End** | Context items ingested | 500+ |
| **P2 End** | Chat queries per day | 20+ |
| **P3 End (Sprint 9)** | External teams onboarded | 3-5 |
| **P3 End** | Monthly active users | 15-30 |
| **P3 End** | Credit revenue | First paying customer |
| **P3 End** | Platform uptime | 99.5%+ |

---

## Review Cadence

- **After each sprint:** CTO reviews shipped features via live URL + test report
- **Weekly:** PM sends Discord summary (shipped, blocked, next up)
- **Bi-weekly:** Full Linear board review with CTO
- **End of P2/P3:** Comprehensive feature review + user feedback session
