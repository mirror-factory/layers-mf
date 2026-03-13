# Layers Comprehensive Improvement & Testing Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematically improve, harden, and test every feature in Layers using a multi-agent team with Linear tracking, E2E testing, and production eval coverage.

**Architecture:** Three-tier agent hierarchy — CTO dispatches sprints to PM agent, PM assigns tasks to Dev Agent 1 (backend/infra) and Dev Agent 2 (frontend/E2E). All work tracked via Linear issues (PROD-xxx). E2E tests use Playwright with Chrome DevTools traces. Production readiness verified via eval suites.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Inngest, Vercel AI SDK, Playwright, Vitest

---

## Agent Assignment Key

| Agent | Focus | Tools |
|-------|-------|-------|
| **Dev Agent 1** | Backend APIs, database, pipeline, integrations, infra | Vitest, Supabase CLI, Inngest dev server |
| **Dev Agent 2** | Frontend components, pages, E2E tests, visual QA | Playwright, Chrome DevTools, Vercel preview |
| **PM Agent** | Linear updates, code review, test verification, reporting | Linear API, GitHub, ntfy |

---

## Sprint 1: Auth & Onboarding Hardening

**Linear Epic:** `PROD-xxx: Auth & Onboarding Hardening`

### Task 1.1: Auth Flow E2E Coverage (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E auth flow — login, signup, reset, OAuth`

**Files:**
- Modify: `e2e/auth.spec.ts`
- Create: `e2e/fixtures/test-user.ts`
- Reference: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/reset-password/page.tsx`

**Step 1: Expand auth E2E tests**

Add tests for:
```typescript
// e2e/auth.spec.ts
test.describe('Authentication Flows', () => {
  test('should login with valid credentials and reach dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', process.env.TEST_EMAIL!);
    await page.fill('[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|\/$/);
    await expect(page.locator('[data-testid="sidebar-nav"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('should navigate login → signup → login', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Sign up');
    await expect(page).toHaveURL('/signup');
    await page.click('text=Log in');
    await expect(page).toHaveURL('/login');
  });

  test('should complete forgot password flow', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should reject invalid credentials with error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

```bash
npx playwright test e2e/auth.spec.ts --project=chromium --trace on
```
Expected: All 5+ tests pass. Trace files generated for debugging.

**Step 3: Commit**

```bash
git add e2e/auth.spec.ts e2e/fixtures/
git commit -m "test: expand auth E2E coverage — login, signup, reset, validation (PROD-xxx)"
```

---

### Task 1.2: Auth Callback Hardening (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Harden OAuth callback — error handling, edge cases`

**Files:**
- Modify: `src/app/(auth)/auth/callback/route.ts`
- Modify: `src/app/(auth)/auth/callback/route.test.ts`

**Step 1: Write failing tests for edge cases**

```typescript
// Add to route.test.ts
describe('OAuth callback edge cases', () => {
  it('should handle missing code parameter', async () => {
    const req = new NextRequest('http://localhost/auth/callback');
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login?error=');
  });

  it('should handle expired OAuth code', async () => {
    // Mock Supabase to return auth error
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'expired' }, data: { session: null }
    });
    const req = new NextRequest('http://localhost/auth/callback?code=expired123');
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('/login?error=');
  });

  it('should handle user without org membership', async () => {
    // User exists but has no org
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: null, data: { session: { user: { id: 'no-org-user' } } }
    });
    mockSupabase.from('org_members').select.mockReturnValue({
      eq: () => ({ data: [], error: null })
    });
    const req = new NextRequest('http://localhost/auth/callback?code=valid');
    const res = await GET(req);
    expect(res.headers.get('location')).toContain('/onboarding');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/app/\\(auth\\)/auth/callback/route.test.ts
```

**Step 3: Implement fixes in callback route**

Add proper error handling for missing code, expired tokens, and missing org membership.

**Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/app/\\(auth\\)/auth/callback/route.test.ts
```

**Step 5: Commit**

```bash
git add src/app/\(auth\)/auth/callback/
git commit -m "fix: harden OAuth callback with edge case handling (PROD-xxx)"
```

---

### Task 1.3: Password Validation Improvements (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Password validation — strength, feedback, consistency`

**Files:**
- Modify: `src/app/(auth)/reset-password/password-validation.test.ts`
- Modify: `src/app/(auth)/reset-password/page.tsx`

**Step 1: Add password strength tests**

Test minimum length, special characters, common password rejection.

**Step 2: Implement consistent validation across signup and reset**

Ensure the same validation logic is shared between signup and reset-password pages.

**Step 3: Run tests and commit**

---

## Sprint 2: Chat System Quality

**Linear Epic:** `PROD-xxx: Chat System Quality & Reliability`

### Task 2.1: Chat API Robustness (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Chat API — error handling, rate limiting, streaming edge cases`

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/chat/route.test.ts`
- Reference: `src/lib/ai/tools.ts`, `src/lib/rate-limit.ts`

**Step 1: Write tests for streaming edge cases**

```typescript
describe('Chat API edge cases', () => {
  it('should handle empty message gracefully', async () => {
    const req = mockChatRequest({ messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should enforce rate limits', async () => {
    // Send 20 rapid requests
    for (let i = 0; i < 20; i++) {
      await POST(mockChatRequest({ messages: [{ role: 'user', content: 'hi' }] }));
    }
    const res = await POST(mockChatRequest({ messages: [{ role: 'user', content: 'hi' }] }));
    expect(res.status).toBe(429);
  });

  it('should handle tool execution errors without crashing stream', async () => {
    // Mock search_context to throw
    mockSearchContext.mockRejectedValue(new Error('DB connection lost'));
    const req = mockChatRequest({ messages: [{ role: 'user', content: 'search for X' }] });
    const res = await POST(req);
    expect(res.status).toBe(200); // Stream should still work, tool returns error
  });

  it('should respect conversation history limits', async () => {
    const longHistory = Array(100).fill({ role: 'user', content: 'message' });
    const req = mockChatRequest({ messages: longHistory });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

**Step 2: Implement fixes**

- Add input validation for empty/malformed messages
- Verify rate limiting works end-to-end
- Add try/catch in tool execution to prevent stream crashes
- Add message history truncation if too long

**Step 3: Run tests and commit**

---

### Task 2.2: Chat E2E Flow (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E chat — send message, receive response, tool calls visible`

**Files:**
- Create: `e2e/chat.spec.ts`
- Reference: `src/components/chat-interface.tsx`, `src/components/ai-elements/`

**Step 1: Create comprehensive chat E2E tests**

```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should render chat interface with input and model selector', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-selector"]')).toBeVisible();
  });

  test('should send a message and receive streaming response', async ({ page }) => {
    await page.goto('/chat');
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('What documents do I have?');
    await input.press('Enter');

    // Wait for assistant response to appear
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({
      timeout: 30000,
    });
  });

  test('should display tool calls when agent searches', async ({ page }) => {
    await page.goto('/chat');
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Search for meeting notes from last week');
    await input.press('Enter');

    // Tool call UI should appear
    await expect(page.locator('[data-testid="tool-call"]').first()).toBeVisible({
      timeout: 30000,
    });
  });

  test('should show source citations in response', async ({ page }) => {
    await page.goto('/chat');
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('What are the key decisions from recent meetings?');
    await input.press('Enter');

    await page.waitForTimeout(15000); // Wait for full response
    // Check for citation badges
    const citations = page.locator('[data-testid="source-citation"]');
    // May or may not have citations depending on context
  });

  test('should switch models via selector', async ({ page }) => {
    await page.goto('/chat');
    await page.click('[data-testid="model-selector"]');
    const options = page.locator('[data-testid="model-option"]');
    await expect(options.first()).toBeVisible();
  });

  test('should persist conversation across page reload', async ({ page }) => {
    await page.goto('/chat');
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Hello, remember this test message');
    await input.press('Enter');

    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({
      timeout: 30000,
    });

    // Reload page
    await page.reload();
    // Conversation should still be visible via history
    await expect(page.locator('[data-testid="user-message"]').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
```

**Step 2: Add data-testid attributes to components**

Add `data-testid` attributes to:
- `chat-interface.tsx`: `chat-input`, `model-selector`, `model-option`
- `ai-elements/message.tsx`: `assistant-message`, `user-message`
- `ai-elements/tool.tsx`: `tool-call`
- `chat/source-citation.tsx`: `source-citation`

**Step 3: Run E2E and capture traces**

```bash
npx playwright test e2e/chat.spec.ts --project=chromium --trace on
npx playwright show-report
```

**Step 4: Commit**

```bash
git add e2e/chat.spec.ts src/components/
git commit -m "test: comprehensive chat E2E with tool calls and citations (PROD-xxx)"
```

---

### Task 2.3: Chat Session API Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Chat session API — CRUD, message persistence, session context`

**Files:**
- Modify: `src/app/api/chat/session/[id]/route.test.ts`
- Modify: `src/app/api/chat/history/route.test.ts`
- Modify: `src/app/api/conversations/route.test.ts`

**Step 1: Add tests for conversation lifecycle**

Test: create conversation → send messages → retrieve history → delete conversation.

**Step 2: Add tests for session-scoped chat**

Test: create session → attach context → chat within session → verify tool searches are scoped.

**Step 3: Run and commit**

---

## Sprint 3: Context Library & Search

**Linear Epic:** `PROD-xxx: Context Library & Search Quality`

### Task 3.1: Context Upload Pipeline Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Upload pipeline — file types, chunking, embedding, dedup`

**Files:**
- Modify: `src/app/api/ingest/upload/route.test.ts`
- Create: `src/lib/pipeline/__tests__/process-context.test.ts`
- Modify: `src/lib/pipeline/__tests__/chunker.test.ts`

**Step 1: Expand chunker tests**

```typescript
// Add to chunker.test.ts
describe('Chunker edge cases', () => {
  it('should handle markdown with code blocks', () => {
    const md = '# Title\n\n```typescript\nconst x = 1;\nconst y = 2;\n```\n\nMore text after code.';
    const chunks = chunkDocument(md, 'Test');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach(c => expect(c.content.length).toBeGreaterThan(0));
  });

  it('should handle very long single-line content', () => {
    const longLine = 'word '.repeat(5000);
    const chunks = chunkDocument(longLine, 'Long');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle Unicode content', () => {
    const unicode = '日本語のテキスト '.repeat(500);
    const chunks = chunkDocument(unicode, 'Unicode');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle content with only whitespace', () => {
    const chunks = chunkDocument('   \n\n\t  ', 'Whitespace');
    expect(chunks.length).toBeLessThanOrEqual(1);
  });
});
```

**Step 2: Write Inngest process-context unit tests**

```typescript
// src/lib/pipeline/__tests__/process-context.test.ts
describe('Process context pipeline', () => {
  it('should extract metadata from raw content', async () => {
    // Test extraction step in isolation
  });

  it('should chunk document and compute embeddings', async () => {
    // Test chunking step with mocked embeddings
  });

  it('should handle reprocessing (delete old chunks)', async () => {
    // Test idempotency
  });

  it('should create inbox items after processing', async () => {
    // Test inbox creation step
  });
});
```

**Step 3: Write upload route edge case tests**

Test: duplicate upload (content_hash dedup), unsupported file type, oversized file, empty file.

**Step 4: Run and commit**

---

### Task 3.2: Search Quality Improvements (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Search quality — hybrid ranking, filters, edge cases`

**Files:**
- Modify: `src/lib/db/search.test.ts`
- Modify: `src/lib/db/search.ts`
- Reference: `src/lib/evals/retrieval.eval.ts`

**Step 1: Add search edge case tests**

```typescript
describe('Search edge cases', () => {
  it('should return empty results for nonsense query', async () => {
    const results = await searchContextChunks(supabase, orgId, 'xyzzy12345nonsense', 10);
    expect(results).toHaveLength(0);
  });

  it('should filter by source_type correctly', async () => {
    const results = await searchContextChunks(supabase, orgId, 'test', 10, {
      sourceType: 'linear'
    });
    results.forEach(r => expect(r.source_type).toBe('linear'));
  });

  it('should filter by date range', async () => {
    const results = await searchContextChunks(supabase, orgId, 'test', 10, {
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-03-01T00:00:00Z',
    });
    // All results should be within range
  });

  it('should respect limit parameter', async () => {
    const results = await searchContextChunks(supabase, orgId, 'meeting', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Run retrieval eval suite**

```bash
EVAL_ORG_ID=<uuid> pnpm eval:retrieval
```

Document baseline scores for Precision@5 and MRR.

**Step 3: Commit**

---

### Task 3.3: Context Library E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E context library — browse, filter, upload, detail view`

**Files:**
- Create: `e2e/context-library.spec.ts`
- Reference: `src/components/context-library.tsx`, `src/components/context-uploader.tsx`

**Step 1: Write context library E2E tests**

```typescript
// e2e/context-library.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Context Library', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should render context library with items', async ({ page }) => {
    await page.goto('/context');
    await expect(page.locator('h1')).toContainText(/context|library/i);
    // Wait for items to load
    await page.waitForLoadState('networkidle');
  });

  test('should filter by source type', async ({ page }) => {
    await page.goto('/context');
    await page.waitForLoadState('networkidle');
    // Click filter dropdown
    const filterBtn = page.locator('[data-testid="source-filter"]');
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.locator('[data-testid="filter-option"]').first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should open context item detail view', async ({ page }) => {
    await page.goto('/context');
    await page.waitForLoadState('networkidle');
    const firstItem = page.locator('[data-testid="context-item"]').first();
    if (await firstItem.isVisible()) {
      await firstItem.click();
      await expect(page).toHaveURL(/\/context\/.+/);
    }
  });

  test('should upload a document', async ({ page }) => {
    await page.goto('/context');
    const uploadBtn = page.locator('[data-testid="upload-btn"]');
    if (await uploadBtn.isVisible()) {
      // Create a test file
      const buffer = Buffer.from('Test document content for E2E testing');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'test-doc.txt',
        mimeType: 'text/plain',
        buffer,
      });
      // Wait for upload completion
      await expect(page.locator('text=accepted')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should export context items', async ({ page }) => {
    await page.goto('/context');
    await page.waitForLoadState('networkidle');
    const exportBtn = page.locator('[data-testid="export-btn"]');
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    }
  });

  test('should perform bulk actions', async ({ page }) => {
    await page.goto('/context');
    await page.waitForLoadState('networkidle');
    // Select multiple items
    const checkboxes = page.locator('[data-testid="context-item-checkbox"]');
    if (await checkboxes.first().isVisible()) {
      await checkboxes.first().check();
      await checkboxes.nth(1).check();
      // Bulk action bar should appear
      await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
    }
  });
});
```

**Step 2: Add data-testid attributes to context components**

**Step 3: Run and capture trace**

```bash
npx playwright test e2e/context-library.spec.ts --project=chromium --trace on
```

**Step 4: Commit**

---

## Sprint 4: Integrations Testing

**Linear Epic:** `PROD-xxx: Integration Reliability`

### Task 4.1: Webhook Handler Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Webhook handlers — signature verification, payload validation`

**Files:**
- Modify: `src/app/api/webhooks/ingest/route.test.ts`
- Create: `src/app/api/webhooks/linear/route.test.ts`
- Create: `src/app/api/webhooks/discord/route.test.ts`
- Create: `src/app/api/webhooks/google-drive/route.test.ts`

**Step 1: Write webhook signature verification tests**

For each webhook handler:
- Test valid signature passes
- Test invalid/missing signature returns 401
- Test malformed payload returns 400
- Test correct data extraction and storage

**Step 2: Write Linear webhook integration tests**

```typescript
describe('Linear webhook', () => {
  it('should process issue.created event', async () => {
    const payload = {
      action: 'create',
      type: 'Issue',
      data: { id: 'issue-1', title: 'Test issue', description: 'Test' },
    };
    const req = mockWebhookRequest(payload, validSignature);
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Verify context item created
  });

  it('should process comment.created event', async () => {
    // Test comment processing
  });

  it('should ignore unsupported event types', async () => {
    const payload = { action: 'create', type: 'Project', data: {} };
    const req = mockWebhookRequest(payload, validSignature);
    const res = await POST(req);
    expect(res.status).toBe(200); // Accepted but no-op
  });
});
```

**Step 3: Write Discord and Google Drive webhook tests**

**Step 4: Run all webhook tests and commit**

---

### Task 4.2: Integration Sync Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Integration sync — Linear, Discord, Google Drive sync flows`

**Files:**
- Modify: `src/app/api/integrations/sync/route.test.ts`
- Create: `src/lib/integrations/linear.test.ts`
- Create: `src/lib/integrations/google-drive.test.ts`
- Create: `src/lib/integrations/discord.test.ts`

**Step 1: Write integration client tests**

For each integration (Linear, Google Drive, Discord):
- Test connection validation
- Test data fetch and transform
- Test error handling (expired tokens, rate limits, API errors)
- Test incremental sync (only new items)

**Step 2: Run and commit**

---

### Task 4.3: Integrations Page E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E integrations — connect, configure, sync status`

**Files:**
- Create: `e2e/integrations.spec.ts`
- Reference: `src/app/(dashboard)/integrations/page.tsx`, `src/components/integrations-connect.tsx`

**Step 1: Write integrations E2E tests**

```typescript
// e2e/integrations.spec.ts
test.describe('Integrations Page', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display available integrations', async ({ page }) => {
    await page.goto('/integrations');
    await expect(page.locator('[data-testid="integration-card"]').first()).toBeVisible();
  });

  test('should show connected integrations with status', async ({ page }) => {
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');
    // Check for connected badges
    const connectedBadges = page.locator('[data-testid="integration-status-connected"]');
    // May or may not have connected integrations
  });

  test('should open connect panel for integration', async ({ page }) => {
    await page.goto('/integrations');
    const card = page.locator('[data-testid="integration-card"]').first();
    await card.click();
    await expect(page.locator('[data-testid="connect-panel"]')).toBeVisible();
  });

  test('should trigger manual sync', async ({ page }) => {
    await page.goto('/integrations');
    const syncBtn = page.locator('[data-testid="sync-btn"]').first();
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
      await expect(page.locator('text=syncing')).toBeVisible({ timeout: 5000 });
    }
  });
});
```

**Step 2: Add data-testid attributes and run**

**Step 3: Commit**

---

## Sprint 5: Sessions & Workspace

**Linear Epic:** `PROD-xxx: Sessions & Workspace Quality`

### Task 5.1: Sessions API Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Sessions API — CRUD, members, context attachment`

**Files:**
- Modify: `src/app/api/sessions/route.test.ts`
- Modify: `src/app/api/sessions/[id]/route.test.ts`
- Modify: `src/app/api/sessions/[id]/members/route.test.ts`
- Modify: `src/app/api/sessions/[id]/context/route.test.ts`

**Step 1: Add comprehensive session lifecycle tests**

```typescript
describe('Session lifecycle', () => {
  it('should create a session with title and description', async () => {
    const req = mockRequest({ title: 'Sprint Planning', description: 'Q2 planning' });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Sprint Planning');
  });

  it('should add members to session', async () => {
    // Create session, then add member
  });

  it('should attach context items to session', async () => {
    // Create session, attach context, verify association
  });

  it('should delete session and clean up associations', async () => {
    // Delete should cascade to session_context and session_members
  });

  it('should prevent duplicate member addition', async () => {
    // Adding same member twice should be idempotent
  });

  it('should validate session ownership for modifications', async () => {
    // User should only modify sessions in their org
  });
});
```

**Step 2: Run and commit**

---

### Task 5.2: Sessions E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E sessions — create, configure, workspace, chat within session`

**Files:**
- Create: `e2e/sessions.spec.ts`
- Reference: `src/app/(dashboard)/sessions/page.tsx`, `src/components/sessions-list.tsx`, `src/components/session-workspace.tsx`

**Step 1: Write sessions E2E tests**

```typescript
// e2e/sessions.spec.ts
test.describe('Sessions', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should list existing sessions', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('h1')).toContainText(/session/i);
    await page.waitForLoadState('networkidle');
  });

  test('should create a new session', async ({ page }) => {
    await page.goto('/sessions');
    await page.click('[data-testid="create-session-btn"]');
    await expect(page.locator('[data-testid="create-session-dialog"]')).toBeVisible();
    await page.fill('[data-testid="session-title"]', 'E2E Test Session');
    await page.click('[data-testid="session-submit"]');
    await expect(page).toHaveURL(/\/sessions\/.+/);
  });

  test('should open session workspace', async ({ page }) => {
    await page.goto('/sessions');
    const session = page.locator('[data-testid="session-item"]').first();
    if (await session.isVisible()) {
      await session.click();
      await expect(page.locator('[data-testid="session-workspace"]')).toBeVisible();
    }
  });

  test('should add context to session via picker', async ({ page }) => {
    // Navigate to session, open context picker, add item
    await page.goto('/sessions');
    const session = page.locator('[data-testid="session-item"]').first();
    if (await session.isVisible()) {
      await session.click();
      const addCtx = page.locator('[data-testid="add-context-btn"]');
      if (await addCtx.isVisible()) {
        await addCtx.click();
        await expect(page.locator('[data-testid="context-picker"]')).toBeVisible();
      }
    }
  });
});
```

**Step 2: Add data-testid attributes and run**

**Step 3: Commit**

---

## Sprint 6: Inbox, Actions & Analytics

**Linear Epic:** `PROD-xxx: Inbox, Actions & Analytics`

### Task 6.1: Inbox Generation Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Inbox — generation quality, filtering, edge cases`

**Files:**
- Modify: `src/lib/inbox/generate.test.ts`
- Modify: `src/app/api/inbox/generate/route.test.ts`

**Step 1: Expand inbox generation tests**

```typescript
describe('Inbox generation', () => {
  it('should generate inbox items from meeting transcript', async () => {
    // Pass a meeting transcript with action items
    // Verify inbox items created with correct types
  });

  it('should deduplicate inbox items', async () => {
    // Generate twice from same content
    // Should not create duplicates
  });

  it('should handle documents with no actionable content', async () => {
    // Pass a generic document
    // Should create 0 or minimal inbox items
  });

  it('should categorize inbox items correctly', async () => {
    // Verify categories: action_item, decision, follow_up, etc.
  });
});
```

**Step 2: Run and commit**

---

### Task 6.2: Actions API Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Actions API — CRUD, status transitions`

**Files:**
- Create: `src/app/api/actions/route.test.ts`
- Reference: `src/lib/db/action-items.ts`

**Step 1: Write action item API tests**

Test create, read, update status (open → in_progress → done), delete, list with filters.

**Step 2: Run and commit**

---

### Task 6.3: Analytics & KPI Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Analytics — KPI computation, dashboard data`

**Files:**
- Modify: `src/lib/kpi/compute.test.ts`
- Reference: `src/app/(dashboard)/analytics/page.tsx`

**Step 1: Expand KPI computation tests**

Test all KPI metrics: agent runs, context items processed, search quality, user engagement.

**Step 2: Run and commit**

---

### Task 6.4: Inbox & Actions E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E inbox & actions — list, interact, complete`

**Files:**
- Create: `e2e/inbox-actions.spec.ts`

**Step 1: Write inbox and actions E2E tests**

```typescript
test.describe('Inbox & Actions', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display inbox items', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.locator('h1')).toContainText(/inbox/i);
    await page.waitForLoadState('networkidle');
  });

  test('should display action items', async ({ page }) => {
    await page.goto('/actions');
    await expect(page.locator('h1')).toContainText(/action/i);
    await page.waitForLoadState('networkidle');
  });

  test('should mark action as complete', async ({ page }) => {
    await page.goto('/actions');
    const actionRow = page.locator('[data-testid="action-item-row"]').first();
    if (await actionRow.isVisible()) {
      const checkbox = actionRow.locator('[data-testid="action-checkbox"]');
      await checkbox.click();
      // Verify status changed
    }
  });

  test('should display analytics dashboard', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.locator('h1')).toContainText(/analytics/i);
    await page.waitForLoadState('networkidle');
  });
});
```

**Step 2: Run and commit**

---

## Sprint 7: Team Management & Settings

**Linear Epic:** `PROD-xxx: Team & Settings`

### Task 7.1: Team API Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Team API — invites, members, roles`

**Files:**
- Modify: `src/app/api/team/invite/route.test.ts`
- Modify: `src/app/api/team/members/route.test.ts`
- Modify: `src/app/api/team/profile/route.test.ts`

**Step 1: Add edge case tests**

```typescript
describe('Team invite edge cases', () => {
  it('should prevent inviting existing member', async () => {
    // Invite user who is already a member
    // Should return appropriate error
  });

  it('should prevent inviting with invalid email', async () => {
    // Invalid email format should be rejected
  });

  it('should expire old invites', async () => {
    // Invite created > 7 days ago should be expired
  });

  it('should handle invite acceptance flow', async () => {
    // Create invite → accept → verify membership
  });
});
```

**Step 2: Run and commit**

---

### Task 7.2: Settings E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E settings — profile, team, audit log`

**Files:**
- Create: `e2e/settings.spec.ts`

**Step 1: Write settings E2E tests**

```typescript
test.describe('Settings Pages', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should render profile settings', async ({ page }) => {
    await page.goto('/settings/profile');
    await expect(page.locator('h1')).toContainText(/profile/i);
  });

  test('should update profile name', async ({ page }) => {
    await page.goto('/settings/profile');
    const nameInput = page.locator('[data-testid="profile-name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User Updated');
      await page.click('[data-testid="save-profile"]');
      await expect(page.locator('text=saved')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should render team management page', async ({ page }) => {
    await page.goto('/settings/team');
    await expect(page.locator('h1')).toContainText(/team/i);
  });

  test('should display audit log', async ({ page }) => {
    await page.goto('/settings/audit');
    await expect(page.locator('h1')).toContainText(/audit/i);
    await page.waitForLoadState('networkidle');
  });
});
```

**Step 2: Run and commit**

---

## Sprint 8: Infrastructure & Pipeline Hardening

**Linear Epic:** `PROD-xxx: Infrastructure & Pipeline`

### Task 8.1: Inngest Pipeline Reliability (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Inngest pipeline — retry behavior, error handling, monitoring`

**Files:**
- Modify: `src/lib/inngest/functions/process-context.ts`
- Create: `src/lib/inngest/functions/__tests__/process-context.test.ts`

**Step 1: Write pipeline step isolation tests**

```typescript
describe('Process context pipeline', () => {
  describe('fetch-item step', () => {
    it('should throw for non-existent item', async () => {
      // Verify retryable error
    });

    it('should set status to processing', async () => {
      // Verify status transition
    });
  });

  describe('extract-metadata step', () => {
    it('should truncate content to 12k chars', async () => {
      // Large document should be truncated
    });

    it('should handle extraction failure gracefully', async () => {
      // AI extraction fails → should throw for retry
    });
  });

  describe('chunk-document step', () => {
    it('should delete old chunks before inserting new', async () => {
      // Reprocessing should be idempotent
    });

    it('should handle empty content', async () => {
      // Empty document → 0 or 1 chunks
    });
  });

  describe('embed-chunks step', () => {
    it('should batch embed in groups of 100', async () => {
      // Verify batching for large documents
    });

    it('should skip when no chunks', async () => {
      // No chunks → no embeddings call
    });
  });
});
```

**Step 2: Implement any missing error handling discovered**

**Step 3: Run and commit**

---

### Task 8.2: Health & Monitoring (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Health endpoint — comprehensive checks, alerting`

**Files:**
- Modify: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

**Step 1: Expand health check**

Add checks for: Supabase connectivity, Inngest reachability, AI Gateway availability, embedding model status.

**Step 2: Write tests and commit**

---

### Task 8.3: Audit Logging Tests (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Audit logging — completeness, query performance`

**Files:**
- Modify: `src/lib/audit.test.ts`
- Modify: `src/app/api/audit/route.ts`

**Step 1: Verify all sensitive operations are logged**

Check: context deletion, team member changes, integration connections, settings changes.

**Step 2: Run and commit**

---

## Sprint 9: Production Eval & Quality Gates

**Linear Epic:** `PROD-xxx: Production Quality Gates`

### Task 9.1: Retrieval Eval Improvements (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Retrieval eval — chunk search, filter accuracy, latency`

**Files:**
- Modify: `src/lib/evals/retrieval.eval.ts`

**Step 1: Expand retrieval eval**

Add tests for:
- Chunk search vs item-level search comparison
- Filter accuracy (source_type, content_type, date range)
- Search latency benchmarks (p50, p95, p99)
- Result relevance with diverse query types

**Step 2: Run baseline and document scores**

```bash
EVAL_ORG_ID=<uuid> pnpm eval:retrieval
```

**Step 3: Commit**

---

### Task 9.2: Agent Eval Improvements (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Agent eval — tool usage, response quality, citation accuracy`

**Files:**
- Modify: `src/lib/evals/agent.eval.ts`

**Step 1: Expand agent eval**

Add tests for:
- Tool call appropriateness (should search when question requires context)
- Tool call avoidance (should not search for greetings/simple questions)
- Citation accuracy (sources referenced match actual results)
- Response coherence with multi-source context

**Step 2: Run and document**

```bash
pnpm eval:agent
```

**Step 3: Commit**

---

### Task 9.3: Extraction Eval Improvements (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Extraction eval — entity recall, summary quality`

**Files:**
- Modify: `src/lib/evals/extraction.eval.ts`
- Add fixtures: `src/lib/evals/fixtures/`

**Step 1: Add diverse fixture types**

Add fixtures for: technical documents, marketing briefs, email threads, Slack exports, code reviews.

**Step 2: Run and document baseline**

```bash
pnpm eval:extraction
```

**Step 3: Commit**

---

### Task 9.4: Context Health Eval (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Context health eval — stale items, missing embeddings, orphans`

**Files:**
- Modify: `src/lib/evals/context-health.eval.ts`

**Step 1: Expand health checks**

- Detect context items with no chunks
- Detect chunks with no embeddings
- Detect stale items (not updated in >30 days)
- Detect orphaned chunks (context_item deleted)
- Report embedding dimension consistency

**Step 2: Run and commit**

---

## Sprint 10: Full Integration E2E & Smoke Tests

**Linear Epic:** `PROD-xxx: Full Integration Testing`

### Task 10.1: Full User Journey E2E (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E full journey — signup to first insight`

**Files:**
- Modify: `e2e/full-flow.spec.ts`

**Step 1: Write end-to-end user journey**

```typescript
test.describe('Full User Journey', () => {
  test('complete flow: login → upload → chat → get answer with citation', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('[name="email"]', process.env.TEST_EMAIL!);
    await page.fill('[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|\/$/);

    // 2. Upload a document
    await page.goto('/context');
    const buffer = Buffer.from('Meeting notes: We decided to launch feature X by March 15. Action: Alfonso to review the design.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'meeting-notes.txt',
      mimeType: 'text/plain',
      buffer,
    });
    await page.waitForTimeout(3000); // Wait for processing

    // 3. Chat about the uploaded content
    await page.goto('/chat');
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('What was decided in the recent meeting?');
    await input.press('Enter');

    // 4. Verify response references the document
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({
      timeout: 60000,
    });
    const response = await page.locator('[data-testid="assistant-message"]').first().textContent();
    expect(response?.toLowerCase()).toContain('feature x');
  });

  test('session flow: create session → add context → scoped chat', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', process.env.TEST_EMAIL!);
    await page.fill('[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    // Create session
    await page.goto('/sessions');
    await page.click('[data-testid="create-session-btn"]');
    await page.fill('[data-testid="session-title"]', 'E2E Test Session');
    await page.click('[data-testid="session-submit"]');

    // Should be in session workspace
    await expect(page.locator('[data-testid="session-workspace"]')).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: Run with trace and screenshots**

```bash
npx playwright test e2e/full-flow.spec.ts --project=chromium --trace on --screenshot on
npx playwright show-report
```

**Step 3: Commit**

---

### Task 10.2: API Smoke Tests (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E API smoke tests — all endpoints respond correctly`

**Files:**
- Modify: `e2e/api.spec.ts`

**Step 1: Expand API smoke test coverage**

Test every API endpoint returns expected status codes:
- All GET endpoints return 200 or 401 (unauthenticated)
- All POST endpoints accept valid payloads
- All DELETE endpoints handle missing IDs gracefully
- Webhook endpoints validate signatures

**Step 2: Run and commit**

---

### Task 10.3: Dashboard Smoke Test (Dev Agent 2)

**Linear Issue:** `PROD-xxx: E2E dashboard — all pages render without errors`

**Files:**
- Modify: `e2e/dashboard.spec.ts`

**Step 1: Write smoke tests for every dashboard page**

```typescript
test.describe('Dashboard Pages Smoke Test', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  const pages = [
    { path: '/', name: 'Dashboard Home' },
    { path: '/chat', name: 'Chat' },
    { path: '/context', name: 'Context Library' },
    { path: '/sessions', name: 'Sessions' },
    { path: '/inbox', name: 'Inbox' },
    { path: '/actions', name: 'Actions' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/integrations', name: 'Integrations' },
    { path: '/settings/profile', name: 'Profile Settings' },
    { path: '/settings/team', name: 'Team Settings' },
    { path: '/settings/audit', name: 'Audit Log' },
    { path: '/api-docs', name: 'API Docs' },
  ];

  for (const { path, name } of pages) {
    test(`${name} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // No JS errors
      expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
    });
  }
});
```

**Step 2: Run and commit**

---

## Sprint 11: Performance & Reliability

**Linear Epic:** `PROD-xxx: Performance & Reliability`

### Task 11.1: API Response Time Benchmarks (Dev Agent 1)

**Linear Issue:** `PROD-xxx: API latency — benchmark all endpoints`

**Step 1: Create performance test file**

```typescript
// src/lib/evals/performance.eval.ts
describe('API Performance', () => {
  const endpoints = [
    { method: 'GET', path: '/api/health', maxMs: 200 },
    { method: 'GET', path: '/api/context/search?q=test', maxMs: 2000 },
    { method: 'GET', path: '/api/sessions', maxMs: 500 },
    { method: 'GET', path: '/api/conversations', maxMs: 500 },
    { method: 'GET', path: '/api/integrations', maxMs: 500 },
  ];

  for (const { method, path, maxMs } of endpoints) {
    it(`${method} ${path} responds within ${maxMs}ms`, async () => {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const elapsed = Date.now() - start;
      expect(res.status).toBeLessThan(500);
      expect(elapsed).toBeLessThan(maxMs);
    });
  }
});
```

**Step 2: Run and document baselines**

**Step 3: Commit**

---

### Task 11.2: Search Latency Optimization (Dev Agent 1)

**Linear Issue:** `PROD-xxx: Search latency — HNSW tuning, query optimization`

**Step 1: Benchmark current search latency**

Run 100 search queries and measure p50, p95, p99.

**Step 2: Tune HNSW index parameters if needed**

Review `ef_search` and `m` parameters for the vector index.

**Step 3: Document findings and commit**

---

## Execution Strategy

### Agent Orchestration

```
CTO (this session)
├── Creates Linear epics and issues for each sprint
├── Dispatches sprint batches to PM agent
│
PM Agent (tmux pane 1)
├── Receives sprint assignment
├── Assigns tasks to dev agents based on focus area
├── Monitors progress via commit messages
├── Posts Linear comments with results
├── Runs E2E smoke tests after each sprint
│
Dev Agent 1 (tmux pane 2) — Backend
├── API route tests
├── Integration tests
├── Pipeline/chunker tests
├── Eval suite improvements
├── Database/search optimization
│
Dev Agent 2 (tmux pane 3) — Frontend/E2E
├── E2E test creation
├── data-testid attribute additions
├── Visual QA with Playwright traces
├── Dashboard smoke tests
├── Full user journey tests
```

### Sprint Cadence

| Sprint | Focus | Dev 1 Tasks | Dev 2 Tasks | Duration |
|--------|-------|-------------|-------------|----------|
| 1 | Auth & Onboarding | 1.2, 1.3 | 1.1 | 2-3h |
| 2 | Chat System | 2.1, 2.3 | 2.2 | 3-4h |
| 3 | Context & Search | 3.1, 3.2 | 3.3 | 3-4h |
| 4 | Integrations | 4.1, 4.2 | 4.3 | 3-4h |
| 5 | Sessions | 5.1 | 5.2 | 2-3h |
| 6 | Inbox/Actions/Analytics | 6.1, 6.2, 6.3 | 6.4 | 3-4h |
| 7 | Team & Settings | 7.1 | 7.2 | 2-3h |
| 8 | Infrastructure | 8.1, 8.2, 8.3 | — | 3-4h |
| 9 | Production Evals | 9.1-9.4 | — | 3-4h |
| 10 | Full Integration E2E | — | 10.1-10.3 | 3-4h |
| 11 | Performance | 11.1, 11.2 | — | 2-3h |

### Linear Issue Creation

For each task, create a Linear issue with:
- **Title:** Task description
- **Labels:** `testing`, `improvement`, or `infrastructure`
- **Priority:** Based on sprint order
- **Assignee:** Dev Agent 1 or Dev Agent 2
- **Description:** Link to this plan, specific steps
- **Parent:** Sprint epic

### Quality Gates

Before marking any sprint complete:

1. **Unit tests:** `pnpm test` — all pass
2. **Type check:** `pnpm typecheck` — no errors
3. **Lint:** `pnpm lint` — no errors
4. **E2E tests:** `npx playwright test` — all pass
5. **Build:** `pnpm build` — succeeds
6. **Coverage:** `pnpm test:coverage` — review new coverage

### Test Infrastructure Requirements

**For E2E tests:**
- Dev server running on port 3000
- Supabase local or staging database with test data
- `E2E_TEST_PASSWORD` env var set
- `TEST_EMAIL` env var set (default: alfonso@roiamplified.com)

**For eval suites:**
- `AI_GATEWAY_API_KEY` set
- `SUPABASE_SERVICE_ROLE_KEY` set
- `EVAL_ORG_ID` set to test org UUID

**For Playwright traces:**
- Chrome DevTools trace capture enabled in playwright.config.ts
- HTML report generation for visual inspection
- Screenshot capture on failure

---

## Summary

| Metric | Current | Target |
|--------|---------|--------|
| Unit test files | 29 | 45+ |
| E2E test files | 6 | 14+ |
| Eval suites | 4 | 6+ |
| API endpoints tested | ~60% | 95%+ |
| Dashboard pages with E2E | 2 | 12 |
| data-testid coverage | Partial | Complete |
| Webhook handlers tested | 1 | 5 |
| Integration clients tested | 1 | 4 |

**Total tasks:** 28 across 11 sprints
**Dev Agent 1 tasks:** 17 (backend/infra)
**Dev Agent 2 tasks:** 11 (frontend/E2E)
