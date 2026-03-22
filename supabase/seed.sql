-- Seed data for local development and testing
-- Run with: npx supabase db reset (auto-applies seed.sql)
-- Or manually: psql $DATABASE_URL -f supabase/seed.sql

-- ============================================================
-- 1. Test user in auth.users (Supabase local dev)
-- ============================================================
-- Supabase local creates auth.users; we insert a test user directly.
-- Password: "password123" (bcrypt hash below)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES (
  '00000000-0000-0000-0000-000000000099',
  'test@mirror.factory',
  '$2a$10$PznfhBOaFiC1v0TQq2uNYeILGq/B0s8K6K2H3dCTVkEp7sVGkm5BK', -- password123
  now(),
  '{"org_name": "Mirror Factory"}'::jsonb,
  now(),
  now(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Test organization
-- ============================================================
-- Clean up any org auto-created by the auth trigger
DELETE FROM organizations WHERE id != '00000000-0000-0000-0000-000000000001';
-- The org_creation trigger fires on auth.users insert, but since
-- we want a deterministic ID, we insert manually and skip the trigger's org.
INSERT INTO organizations (id, name, slug, credit_balance, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Mirror Factory',
  'mirror-factory',
  5000,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Link test user to org as owner
INSERT INTO org_members (id, org_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099',
  'owner'
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- ============================================================
-- 3. Context items (diverse sources)
-- ============================================================

-- A meeting transcript (Granola)
INSERT INTO context_items (id, org_id, source_type, source_id, title, description_short, description_long, raw_content, content_type, entities, status, ingested_at, processed_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'granola', 'meeting-001',
  'Q1 Planning Meeting — Product Roadmap',
  'Team discussed Q1 priorities including pricing model, integration expansion, and Ditto personalization.',
  'The team met on Monday to align on Q1 priorities. Alfonso presented the product roadmap covering three main areas: finalizing the usage-based pricing model with three tiers (Free, Starter, Pro), expanding integrations beyond the current six to include Google Calendar and Notion, and beginning work on the Ditto personalization engine. Key decisions: usage-based pricing approved, Notion integration prioritized over Gmail, and Ditto MVP scoped to interaction tracking plus profile generation. Action items: Alfonso to finalize pricing tiers by Friday, dev team to start Notion integration next sprint, design to create Ditto profile mockups.',
  'Meeting Transcript — Q1 Planning
Date: January 15, 2026
Attendees: Alfonso Morales, Sarah Chen, Marcus Johnson

Alfonso: Let''s start with the pricing model. We''ve been going back and forth between per-seat and usage-based. After looking at the data, I think usage-based makes more sense for our market.

Sarah: Agreed. The credit system we built during the Gateway phase already supports this. We just need to define the tiers.

Alfonso: Right. I''m thinking three tiers: Free at 50 credits per month, Starter at 500 for $19/month, and Pro at 5,000 for $49/month.

Marcus: That seems reasonable. What counts as a credit?

Alfonso: One chat query is 1 credit. Document extraction is 2 credits. Embedding is half a credit. So a typical user doing 10 chats and uploading 5 docs per day would use about 20 credits.

Sarah: For integrations, should we prioritize Notion or Gmail next?

Alfonso: Notion. More teams use it for documentation, and the block-based content converts well to our pipeline. Gmail can wait for Sprint 8.

Marcus: What about Ditto? The investor overview promises personalization.

Alfonso: MVP scope: track what users search and click, build a preference profile, use it to boost relevant results. No proactive suggestions yet — that''s P3.

Action Items:
- Alfonso: Finalize pricing tiers by Friday
- Dev team: Start Notion integration next sprint
- Sarah: Create Ditto profile mockups by Wednesday',
  'meeting_transcript',
  '{"people": ["Alfonso Morales", "Sarah Chen", "Marcus Johnson"], "topics": ["pricing", "integrations", "Ditto", "roadmap"], "decisions": ["Usage-based pricing approved with three tiers", "Notion integration prioritized over Gmail", "Ditto MVP scoped to tracking + profiles"], "action_items": ["Finalize pricing tiers by Friday", "Start Notion integration next sprint", "Create Ditto profile mockups by Wednesday"], "projects": ["Layers Platform", "Ditto"], "sentiment": "positive"}',
  'ready', now() - interval '7 days', now() - interval '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- A Linear issue
INSERT INTO context_items (id, org_id, source_type, source_id, title, description_short, description_long, raw_content, content_type, entities, status, ingested_at, processed_at)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'linear', 'issue-PROD-145',
  'PROD-145: Implement usage-based pricing with three tiers',
  'Create Free (50 credits/mo), Starter (500/$19), and Pro (5000/$49) tiers with Stripe integration.',
  'Implement the usage-based pricing model as discussed in the Q1 planning meeting. This involves creating three subscription tiers in Stripe, building the plan selection UI on signup, and wiring credit deduction into all AI operations. The credit system foundation already exists from the Gateway phase — we need to add subscription management on top.',
  'Issue: PROD-145
Title: Implement usage-based pricing with three tiers
Status: Done
Assignee: Alfonso Morales
Priority: Urgent
Labels: billing, feature

Description:
Create three pricing tiers:
- Free: 50 credits/month, 1 user, 3 integrations
- Starter ($19/mo): 500 credits/month, 5 users, unlimited integrations
- Pro ($49/mo): 5,000 credits/month, unlimited users, priority support

Requirements:
1. Stripe subscription products for Starter and Pro
2. Plan selection on signup page
3. Credit deduction middleware on all AI calls
4. Monthly credit reset cron
5. Usage logging for billing display

ID: PROD-145 | Status: Done | Assignee: Alfonso Morales | Priority: Urgent | Labels: billing, feature',
  'issue',
  '{"people": ["Alfonso Morales"], "topics": ["pricing", "billing", "Stripe", "subscriptions"], "decisions": ["Three-tier pricing model"], "action_items": ["Create Stripe products", "Build plan selection UI", "Wire credit deduction"], "projects": ["Layers Platform"]}',
  'ready', now() - interval '5 days', now() - interval '5 days'
)
ON CONFLICT (id) DO NOTHING;

-- A Google Drive document
INSERT INTO context_items (id, org_id, source_type, source_id, title, description_short, description_long, raw_content, content_type, entities, status, ingested_at, processed_at)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'google-drive', 'doc-pricing-strategy',
  'Q1 Pricing Strategy — Analysis & Recommendation',
  'Comprehensive analysis of pricing models for Layers platform with competitive research and recommendation.',
  'This document analyzes three pricing approaches for Layers: per-seat, usage-based, and hybrid. After evaluating competitor pricing (Notion AI at $10/user/mo, Glean at enterprise pricing, Dust.tt at $25/user/mo), usage-based emerges as the best fit for our market position. Key finding: usage-based pricing aligns cost with value delivered and has lower barrier to entry for small teams.',
  'Q1 Pricing Strategy
Author: Alfonso Morales
Last Updated: January 10, 2026

## Executive Summary
After analyzing three pricing models, we recommend usage-based pricing with credit tiers. This approach best aligns cost with value for AI-native products where resource consumption varies significantly by user.

## Competitive Landscape
- Notion AI: $10/user/month (add-on to base Notion plan)
- Glean: Enterprise pricing, typically $15-25/user/month
- Dust.tt: $25/user/month for Pro
- Mem.ai: $15/user/month

## Analysis

### Option A: Per-Seat ($15/user/month)
Pros: Predictable revenue, simple to understand
Cons: Doesn''t scale with actual usage, penalizes large teams with light users

### Option B: Usage-Based (Credits)
Pros: Aligns cost with value, lower entry barrier, scales naturally
Cons: Less predictable revenue, harder to forecast

### Option C: Hybrid (Base + Usage)
Pros: Guaranteed minimum revenue + usage upside
Cons: Complex pricing, harder to communicate

## Recommendation
Option B (Usage-Based) with three tiers:
- Free: 50 credits/month — try before you buy
- Starter ($19/mo): 500 credits — small teams
- Pro ($49/mo): 5,000 credits — active teams

One credit = one AI operation (chat query, document extraction, etc.)

## Revenue Projections
At 100 teams (avg Starter): $1,900 MRR
At 100 teams (avg Pro): $4,900 MRR',
  'document',
  '{"people": ["Alfonso Morales"], "topics": ["pricing", "revenue", "competitive analysis", "subscriptions"], "decisions": ["Usage-based pricing recommended", "Three tiers: Free, Starter, Pro"], "action_items": [], "projects": ["Layers Platform"], "sentiment": "positive"}',
  'ready', now() - interval '10 days', now() - interval '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- A Slack message batch
INSERT INTO context_items (id, org_id, source_type, source_id, title, description_short, description_long, raw_content, content_type, entities, status, ingested_at, processed_at)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'slack', 'slack-C001-2026-W03',
  '#product — recent messages (W03)',
  'Team discussion about pricing tiers, Notion integration timeline, and Ditto personalization approach.',
  'Slack channel #product discussion covering pricing decisions, integration priorities, and personalization features for the Layers platform.',
  '#product — Mirror Factory
Messages: 8
Period: Jan 13-17, 2026

[2026-01-13 09:15] alfonso: Just pushed the pricing analysis doc to Drive. TL;DR — going with usage-based, three tiers.
[2026-01-13 09:22] sarah: Makes sense. The credit system from Gateway is solid, just needs subscription management on top.
[2026-01-13 10:05] marcus: Quick question — do credits expire monthly or roll over?
[2026-01-13 10:12] alfonso: Roll over, up to 2x monthly allocation. So Free users can save up to 100 credits.
[2026-01-14 14:30] sarah: Started looking at the Notion API. Their block-based structure is interesting — each page is a tree of blocks (paragraphs, headings, lists, code, etc.)
[2026-01-14 14:45] alfonso: Perfect. We need to recursively fetch child blocks and convert to plain text. Depth limit of 2 should be enough.
[2026-01-15 11:00] marcus: For Ditto, should we start with tracking or the profile generation?
[2026-01-15 11:15] alfonso: Tracking first. We need data before we can build profiles. Track searches, clicks, and dismissals. Use sendBeacon so it doesn''t block the UI.',
  'message',
  '{"people": ["alfonso", "sarah", "marcus"], "topics": ["pricing", "credits", "Notion API", "Ditto tracking"], "decisions": ["Credits roll over up to 2x monthly allocation", "Notion block recursion depth limit of 2", "Start Ditto with tracking before profiles"], "action_items": ["Look at Notion API block structure"], "projects": ["Layers Platform", "Ditto"]}',
  'ready', now() - interval '3 days', now() - interval '3 days'
)
ON CONFLICT (id) DO NOTHING;

-- A Discord message
INSERT INTO context_items (id, org_id, source_type, source_id, title, description_short, description_long, raw_content, content_type, entities, status, ingested_at, processed_at)
VALUES (
  '10000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'discord', 'discord-channel-dev-2026-W03',
  '#dev — Mirror Factory (W03)',
  'Technical discussion about pipeline performance, embedding model choice, and chunking strategy.',
  'Discord #dev channel discussion about technical implementation details for the Layers AI pipeline.',
  'Discord — #dev in Mirror Factory
Messages: 6
Period: Jan 13-17, 2026

[2026-01-13 16:00] alfonso: Pipeline is running at about 45 seconds per document now. The extraction step takes the longest — 15-20s.
[2026-01-13 16:10] marcus: Could we switch to a faster model for extraction? We''re using Haiku which is already fast.
[2026-01-13 16:15] alfonso: The bottleneck is the generateObject call, not the model. Complex schemas with nested arrays take longer to generate.
[2026-01-14 09:30] sarah: Looked into the embedding model options. text-embedding-3-small at 1536 dims is good enough for our scale. The 3-large model (3072 dims) is 6.5x more expensive with only marginal quality improvement.
[2026-01-14 09:45] alfonso: Agreed. We can always upgrade later. The chunking strategy matters more — our parent-child approach (400 token child, 1500 token parent) gives good precision.
[2026-01-15 14:00] marcus: Just ran the retrieval eval suite. Getting 0.82 MRR with the current hybrid search setup. Not bad for a first pass.',
  'message',
  '{"people": ["alfonso", "marcus", "sarah"], "topics": ["pipeline performance", "embedding models", "chunking strategy", "retrieval quality"], "decisions": ["Keep text-embedding-3-small", "Parent-child chunking at 400/1500 tokens"], "action_items": [], "projects": ["Layers Platform"], "sentiment": "positive"}',
  'ready', now() - interval '3 days', now() - interval '3 days'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Test session
-- ============================================================
INSERT INTO sessions (id, org_id, name, goal, status, created_by, created_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Q1 Product Sprint',
  'Ship pricing, Notion integration, and Ditto MVP',
  'active',
  '00000000-0000-0000-0000-000000000099',
  now() - interval '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Link context items to session
-- ============================================================
INSERT INTO session_context_links (id, session_id, context_item_id, relevance_score, added_by)
VALUES
  (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 0.95, 'auto'),
  (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 0.90, 'auto'),
  (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 0.85, 'auto')
ON CONFLICT (session_id, context_item_id) DO NOTHING;

-- ============================================================
-- 6. Inbox items
-- ============================================================
INSERT INTO inbox_items (id, org_id, user_id, context_item_id, type, title, body, priority, status, source_type, created_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099',
   '10000000-0000-0000-0000-000000000001', 'action_item', 'Finalize pricing tiers by Friday',
   'From Q1 Planning Meeting — Alfonso committed to finalizing the three pricing tiers.', 'high', 'unread', 'granola', now() - interval '5 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099',
   '10000000-0000-0000-0000-000000000002', 'decision', 'Usage-based pricing approved',
   'Team approved usage-based pricing with Free/Starter/Pro tiers during Q1 planning.', 'normal', 'unread', 'linear', now() - interval '5 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099',
   '10000000-0000-0000-0000-000000000003', 'new_context', 'New document: Q1 Pricing Strategy',
   'Alfonso shared a pricing analysis document in Google Drive.', 'normal', 'unread', 'google-drive', now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Action item statuses (for the meeting transcript)
-- ============================================================
INSERT INTO action_item_status (id, org_id, context_item_id, action_index, status)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 0, 'done'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'pending'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, 'pending')
ON CONFLICT (context_item_id, action_index) DO NOTHING;

-- ============================================================
-- NOTE: Seed data does NOT include vector embeddings.
-- Full-text search will find these items. For vector search,
-- run: npx tsx scripts/embed-seed-data.ts
-- ============================================================
