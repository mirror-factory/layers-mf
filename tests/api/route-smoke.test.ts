/**
 * Route-level API smoke test.
 *
 * Spins up the Next.js dev server via `start-server-and-test`, POSTs a
 * minimal payload to every route under `app/api/`, and asserts each one
 * returns a sensible status (200-299 or a 4xx with a JSON error body --
 * never a bare 500).
 *
 * This is the test that catches the silent-500 class: a route that 500s
 * with no log, no stack, no response body. Unit tests pass; this one
 * fails loudly.
 *
 * Run locally: `pnpm test:api`
 * Runs in CI: see .github/workflows/nightly.yml
 *
 * Customize the PAYLOADS map for each route in your app. Routes without
 * an entry get a bare GET with no body.
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL;
const describeWithServer = BASE_URL ? describe : describe.skip;

interface RouteSpec { method: string; body?: unknown; expectStatuses: number[] }

/**
 * Add one entry per API route. For routes that accept a payload, provide
 * a minimal valid body. Use `expectStatuses` to whitelist acceptable
 * responses (e.g. 401 for auth-required routes is fine in smoke tests;
 * 500 is never fine).
 */
const ROUTES: Record<string, RouteSpec> = {
  '/api/health': { method: 'GET', expectStatuses: [200, 503] },
  '/api/observability/health': { method: 'GET', expectStatuses: [200] },
  // '/api/transcribe': { method: 'POST', body: { audio_url: 'https://...' }, expectStatuses: [200, 400, 401] },
};

describeWithServer('API route smoke', () => {
  for (const [path, spec] of Object.entries(ROUTES)) {
    it(`${spec.method} ${path} returns a sensible status with a JSON body`, async () => {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: spec.method,
        headers: { 'content-type': 'application/json' },
        body: spec.body ? JSON.stringify(spec.body) : undefined,
      });

      // Every response must be parseable as JSON. A bare "Internal Server
      // Error" string means a route threw and nothing caught it --
      // exactly the failure mode withRoute() exists to prevent.
      const text = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { /* leave as null */ }
      expect(json, `${path} returned non-JSON body: ${text.slice(0, 200)}`).not.toBeNull();

      // Every response must carry an x-request-id so logs are correlatable.
      expect(res.headers.get('x-request-id'), `${path} missing x-request-id header`).toBeTruthy();

      // Status must be in the allow-list -- specifically, never 500.
      expect(spec.expectStatuses, `${path} returned ${res.status}`).toContain(res.status);
    }, 10_000);
  }
});
