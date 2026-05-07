/**
 * Tests for Langfuse client initialization.
 *
 * Two cases:
 *   1. Returns a noop client when env vars are missing — so callers can call
 *      `.trace()` unconditionally without guards.
 *   2. Returns a real client when env vars are present.
 *
 * The factory is module-cached, so each test resets module state via
 * `vi.resetModules()` before re-importing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('langfuse-init', () => {
  beforeEach(() => {
    vi.resetModules();
    // Strip any pre-existing langfuse env so each test starts clean.
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_HOST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns a noop client when env vars are missing', async () => {
    const { getLangfuseClient } = await import('./langfuse-init');

    const client = getLangfuseClient();

    expect(client.kind).toBe('noop');
    // Noop trace + flush must not throw — this is the contract the rest of the
    // codebase relies on, so it can call them unconditionally.
    expect(() => client.trace('test-trace', { foo: 'bar' })).not.toThrow();
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it('returns a real client when env vars are present', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk_lf_test';
    process.env.LANGFUSE_SECRET_KEY = 'sk_lf_test';
    process.env.LANGFUSE_HOST = 'https://langfuse.example.com';

    const { getLangfuseClient } = await import('./langfuse-init');

    const client = getLangfuseClient();

    expect(client.kind).toBe('real');
    expect(typeof client.trace).toBe('function');
    expect(typeof client.flush).toBe('function');
  });

  it('memoizes the client across calls in a single module load', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk_lf_test';
    process.env.LANGFUSE_SECRET_KEY = 'sk_lf_test';

    const { getLangfuseClient } = await import('./langfuse-init');

    const a = getLangfuseClient();
    const b = getLangfuseClient();

    expect(a).toBe(b);
  });
});
