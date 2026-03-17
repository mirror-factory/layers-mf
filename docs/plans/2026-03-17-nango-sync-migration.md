# Nango Sync Engine Migration Plan

> **Created:** 2026-03-17
> **PM:** Claude (CTO agent)
> **Priority:** High
> **Rationale:** We're using Nango as a $20/mo OAuth proxy when it has a full sync engine that eliminates 80% of our custom integration code.

---

## Why We're Doing This

### Current State (Proxy-Only)

| Problem | Impact |
|---------|--------|
| Every sync is manual — user clicks "Sync" | Data goes stale within minutes |
| 400+ lines of custom fetch logic per provider | Maintenance burden, bugs |
| No background sync | Users must remember to sync |
| No incremental tracking (most providers) | Re-fetches everything each time |
| 60-second timeout on sync requests | Can't sync large datasets |
| Rate limits handled manually | Fragile, provider-specific |

### Target State (Sync Engine)

| Benefit | How |
|---------|-----|
| Automatic background sync every 15-30 min | Nango sync schedules |
| Incremental change detection | Nango tracks cursors/tokens |
| Built-in pagination + retries + rate limits | Nango runtime |
| 600+ pre-built sync scripts | Use or customize |
| Webhook delivery when new data arrives | `/api/webhooks/nango` |
| "Sync now" button triggers immediate sync | Nango trigger API |

### Lines of Code Eliminated

| File | Lines | Replaced By |
|------|-------|-------------|
| `fetchGoogleDrive()` in sync route | ~80 | Nango Google Drive sync script |
| `fetchSlack()` in sync route | ~55 | Nango Slack sync script |
| `fetchLinear()` in sync route | ~70 | Nango Linear sync script |
| `fetchDiscord()` in sync route | ~60 | Nango Discord sync script (custom) |
| `fetchGitHub()` in sync route | ~50 | Nango GitHub sync script |
| `fetchGranola()` in sync route | ~50 | Nango custom sync script |
| **Total** | **~365** | **Nango config + webhook handler** |

---

## Architecture

### Before (Current)

```
User clicks "Sync"
  → POST /api/integrations/sync
    → nango.proxy() raw API calls (our code handles pagination, mapping)
    → AI extraction + embedding (in same request, 60s timeout)
    → Response with count
```

### After (Sync Engine)

```
Nango runs sync on schedule (every 15-30 min)
  → Nango handles pagination, rate limits, incremental tracking
  → Nango caches records in encrypted store
  → Nango sends webhook to POST /api/webhooks/nango
    → Our webhook handler fetches records via nango.listRecords()
    → Triggers Inngest pipeline for AI extraction + embedding (no timeout)

User clicks "Sync Now" (optional override)
  → POST /api/integrations/sync-trigger
    → Calls Nango API to trigger immediate sync for that connection
    → Returns immediately, webhook arrives when done
```

### Key Insight

The AI extraction + embedding step should NOT be in the sync request. It should be triggered asynchronously via Inngest (which we already have). The current approach jams everything into a 60-second HTTP request. The new approach:

1. Nango syncs raw data → webhook
2. Webhook inserts `context_items` with `status: "pending"`
3. Triggers Inngest pipeline for each item (extraction, chunking, embedding)
4. No timeout issues, retries built in

---

## Implementation Tasks

### Task 1: Enhance Nango Webhook Handler
**File:** `src/app/api/webhooks/nango/route.ts`
**What:** Make the existing webhook handler the primary ingestion path
- On `sync` events: fetch records via `nango.listRecords()`
- Insert each record as a `context_items` row with `status: "pending"`
- Trigger Inngest `process-context` pipeline for each item
- Handle deduplication (check `source_id` before inserting)
- Map provider-specific data to our unified `context_items` schema

### Task 2: Write Nango Sync Scripts (or use pre-built)
**Directory:** Create `nango-integrations/` at project root

For each provider, either use a pre-built Nango sync or write a custom one:

| Provider | Approach | Nango Model |
|----------|----------|-------------|
| Google Drive | Pre-built `google-drive:documents` sync | Files with metadata |
| Linear | Custom sync via GraphQL | Issues + comments + projects |
| Slack | Pre-built `slack:messages` sync | Channel messages |
| Discord | Custom sync (no pre-built) | Guild messages |
| GitHub | Pre-built `github:issues` sync | Repository issues |
| Granola | Custom sync (no pre-built) | Meeting transcripts |

### Task 3: Configure Sync Schedules
**Where:** Nango dashboard + nango.yaml (if using code-first)

| Provider | Frequency | Type |
|----------|-----------|------|
| Google Drive | Every 15 min | Incremental |
| Linear | Every 15 min | Incremental |
| Slack | Every 30 min | Incremental |
| Discord | Every 30 min | Incremental |
| GitHub | Every 1 hour | Incremental |
| Granola | Every 1 hour | Full (small dataset) |

### Task 4: Add "Sync Now" Trigger
**File:** `src/app/api/integrations/sync-trigger/route.ts`
**What:** New endpoint that triggers an immediate Nango sync
- Calls Nango's trigger sync API
- Returns immediately (202 Accepted)
- Webhook arrives when sync completes
- UI shows "Sync requested..." then updates when webhook fires

### Task 5: Sync Status Dashboard
**File:** `src/components/integrations/integration-card.tsx`
**What:** Show background sync status per integration
- Last sync time (from Nango)
- Next scheduled sync time
- Items synced in last sync
- Sync health indicator (green/yellow/red)
- "Sync Now" button triggers immediate sync

### Task 6: Remove Custom Fetch Functions
**File:** `src/app/api/integrations/sync/route.ts`
**What:** Delete `fetchGoogleDrive`, `fetchSlack`, `fetchLinear`, `fetchDiscord`, `fetchGitHub`, `fetchGranola`
- Keep the route as a thin wrapper that triggers Nango sync
- All data processing moves to webhook handler + Inngest pipeline

---

## Migration Strategy

**Phase 1 (this session):** Enhance webhook handler + write data mapper
**Phase 2 (Sprint 5):** Configure Nango syncs + remove custom fetch code
**Phase 3 (Sprint 5):** Sync status dashboard + "Sync Now" button

We start with Phase 1 because it's the foundation — the webhook handler needs to be solid before we can route all syncs through it.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Nango sync scripts may not match our exact needs | We can customize or write our own |
| Nango free tier limits | We're already paying; sync engine included |
| Data format differences between proxy and sync | Write comprehensive data mapper with tests |
| Webhook delivery reliability | Nango has built-in retry; we add idempotency |

---

## Linear Issues (Blocked by Free Tier Limit)

These should be created when Linear capacity is available:

1. **PROD-S4-INT-01:** Enhance Nango webhook handler as primary ingestion path (Urgent)
2. **PROD-S4-INT-02:** Write data mappers for all 6 providers (High)
3. **PROD-S4-INT-03:** Configure Nango sync schedules (High)
4. **PROD-S4-INT-04:** Sync trigger API + "Sync Now" button (Normal)
5. **PROD-S4-INT-05:** Remove custom fetch functions from sync route (Normal)
6. **PROD-S4-INT-06:** Sync status dashboard in integration cards (Normal)
