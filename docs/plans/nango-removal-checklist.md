# Nango Removal Checklist

Sprint 4 task: Remove all remaining Nango code and `@nangohq` dependencies.

## Current State

Direct API clients already exist in `src/lib/api/` for: Granola, Linear, Discord, Notion, Gmail, Drive, Google Auth. These replace the Nango proxy pattern for those services.

Nango is still used as:
1. **OAuth connection manager** (connect UI, token storage/refresh)
2. **API proxy** (`nango.proxy()` calls in Discord, Linear, Google Drive integrations)
3. **Sync orchestration** (`nango.triggerSync()`, webhook-driven record syncing)

---

## Files Referencing Nango

### Can Remove Now (Granola + Linear have direct API clients)

| File | Usage | Notes |
|------|-------|-------|
| `nango-integrations/linear/` | Nango sync definitions (issues, projects, teams, etc.) | Direct client at `src/lib/api/linear.ts` |
| `nango-integrations/notion/` | Nango sync definitions | Direct client at `src/lib/api/notion.ts` |
| `nango-integrations/google-calendar/` | Nango sync definitions | Can use Google Auth from `src/lib/api/google-auth.ts` |
| `nango-integrations/index.ts` | Barrel export | Remove with directory |
| `nango-integrations/package.json` | Nango integration deps | Remove with directory |
| `nango-integrations/tsconfig.json` | TS config for integrations | Remove with directory |
| `nango-integrations/pnpm-lock.yaml` | Lock file | Remove with directory |
| `nango-integrations/.nango/` | Generated schema files | Remove with directory |
| `src/lib/integrations/nango-mappers.ts` | Record mappers for Nango sync webhook | No longer needed with direct clients |
| `src/lib/integrations/__tests__/nango-mappers.test.ts` | Tests for above | Remove with mappers |
| `src/app/api/webhooks/nango/route.ts` | Nango webhook handler (sync completion) | Replace with direct polling/cron |
| `src/app/api/webhooks/nango/route.test.ts` | Tests for above | Remove with route |

### Need Migration First (Still Using Nango Proxy/OAuth)

| File | Usage | Migration Needed |
|------|-------|-----------------|
| `src/lib/nango/client.ts` | Server-side Nango client (`@nangohq/node`) | Remove after all consumers migrated |
| `src/lib/integrations/discord.ts` | Uses `nango.proxy()` for Discord API calls | Migrate to direct Discord API (client exists at `src/lib/api/discord.ts`) |
| `src/lib/integrations/discord.test.ts` | Mocks `nango.proxy()` | Update mocks to direct client |
| `src/lib/integrations/linear.ts` | Uses `nango.proxy()` for Linear GraphQL | Migrate to direct Linear client (`src/lib/api/linear.ts`) |
| `src/lib/integrations/linear.test.ts` | Mocks `nango.proxy()` | Update mocks to direct client |
| `src/lib/integrations/google-drive.ts` | Uses `nango.proxy()` for Drive API | Migrate to direct Drive client (`src/lib/api/drive.ts`) |
| `src/lib/integrations/google-drive.test.ts` | Mocks `nango.proxy()` | Update mocks to direct client |
| `src/lib/integrations/granola.ts` | Uses `nango` import (check if still active) | Direct client exists at `src/lib/api/granola.ts` |
| `src/lib/integrations/granola.test.ts` | Tests for above | Update if needed |
| `src/components/integrations/connect-panel.tsx` | Uses `@nangohq/frontend` for OAuth connect UI | Replace with custom OAuth flow or direct provider OAuth |
| `src/components/integrations-connect.tsx` | Uses `@nangohq/frontend` for OAuth connect UI | Replace with custom OAuth flow |
| `src/components/integrations/integration-card.tsx` | References `nango_connection_id` field | Update to use new connection ID scheme |
| `src/app/api/integrations/connect-session/route.ts` | `nango.createConnectSession()` | Replace with direct OAuth initiation |
| `src/app/api/integrations/sync-trigger/route.ts` | `nango.triggerSync()` + `nango_connection_id` | Replace with direct API polling/cron |
| `src/app/api/integrations/save-connection/route.ts` | Stores `nango_connection_id` | Update to new connection storage |
| `src/app/api/integrations/route.ts` | Selects `nango_connection_id` from DB | Update query |
| `src/app/api/integrations/discord/sync/route.ts` | References `nango_connection_id` | Update to direct sync |
| `src/app/api/integrations/linear/sync/route.ts` | References `nango_connection_id` | Update to direct sync |
| `src/app/api/integrations/google-drive/sync/route.ts` | Uses `nango.proxy()` + `nango_connection_id` | Migrate to `src/lib/api/drive.ts` |
| `src/app/api/integrations/sync/route.ts` | Uses `nango.proxy()` | Migrate to direct client |
| `src/app/api/integrations/sync/route.test.ts` | Mocks `@/lib/nango/client` | Update mocks |

### Indirect References (Config/Test/Types)

| File | Usage | Action |
|------|-------|--------|
| `src/lib/database.types.ts` | `nango_connection_id` column in `context_items` + `integrations` | DB migration to rename/remove column |
| `src/app/(dashboard)/integrations/page.tsx` | Selects `nango_connection_id` | Update query |
| `src/app/(dashboard)/api-docs/page.tsx` | Documents `nango_connection_id` in API docs + `/api/webhooks/nango` | Update docs |
| `vitest.config.ts` | Excludes `nango-integrations/` from test runs | Remove exclusion |
| `e2e/api.spec.ts` | E2E test for `POST /api/webhooks/nango` | Remove test case |
| `.next/types/routes.d.ts` | Auto-generated, references nango routes | Auto-regenerates |
| `.next/dev/types/routes.d.ts` | Auto-generated | Auto-regenerates |
| `docs/plans/2026-03-17-nango-sync-migration.md` | Existing migration plan | Archive or update |

---

## Package Removal

```bash
# Remove Nango packages from root
pnpm remove @nangohq/frontend @nangohq/node

# Remove nango-integrations directory entirely
rm -rf nango-integrations/

# Remove env vars from .env / Vercel
# - NANGO_SECRET_KEY
# - NANGO_PUBLIC_KEY (if exists)
# - NANGO_WEBHOOK_SECRET (if exists)
```

---

## Database Migration

```sql
-- After all code is migrated, remove the column
ALTER TABLE integrations DROP COLUMN IF EXISTS nango_connection_id;
ALTER TABLE context_items DROP COLUMN IF EXISTS nango_connection_id;

-- Then regenerate types
-- pnpm supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```

---

## Migration Order

1. **Verify direct API clients work** for Discord, Linear, Google Drive (they exist in `src/lib/api/`)
2. **Migrate `src/lib/integrations/*.ts`** from `nango.proxy()` to direct API clients
3. **Replace OAuth connect UI** (`connect-panel.tsx`, `integrations-connect.tsx`) with direct OAuth flows
4. **Update API routes** to stop referencing `nango_connection_id`
5. **Remove Nango-only files**: `nango-integrations/`, `nango-mappers.ts`, webhook route
6. **Remove `src/lib/nango/client.ts`**
7. **Remove packages**: `@nangohq/frontend`, `@nangohq/node`
8. **DB migration**: Drop `nango_connection_id` columns
9. **Clean up**: Update tests, vitest config, e2e specs, api-docs page
