/**
 * Dashboard auth guard for `/dev-kit/*` and `/api/dev-kit/*`.
 *
 * Exported as a standalone module so projects can compose the guard with
 * their own middleware. The kit's own `middleware.ts` calls it too.
 *
 * Policy:
 *   DEV_KIT_DASHBOARD_SECRET set     -> require `?token=<secret>` query OR
 *                                       `x-dev-kit-token` header. 401 JSON
 *                                       on mismatch.
 *   DEV_KIT_DASHBOARD_SECRET unset:
 *     NODE_ENV === 'production'      -> 403 JSON with a hint to set the env.
 *     otherwise (dev)                -> pass, warn once per process.
 *
 * Why header OR query: the UI is easiest to hit via `?token=`; programmatic
 * callers prefer a header. Timing-safe compare on both paths keeps the
 * guard from leaking secret length via early return.
 */
import { NextResponse, type NextRequest } from 'next/server';

const HEADER_NAME = 'x-dev-kit-token';
const QUERY_NAME = 'token';

let warnedAboutMissingSecret = false;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: 'dev_kit_unauthorized', message },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Returns a NextResponse when the request should be rejected, or null when
 * it should continue through the rest of the middleware chain.
 */
export function devKitAuthGuard(request: NextRequest): NextResponse | null {
  const secret = process.env.DEV_KIT_DASHBOARD_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return unauthorized(
        'set DEV_KIT_DASHBOARD_SECRET to enable prod access',
        403,
      );
    }
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      // Single warn line per process so dev logs stay clean.
      // eslint-disable-next-line no-console
      console.warn('[dev-kit] DEV_KIT_DASHBOARD_SECRET unset -- dashboard is open in dev only. Set it before deploying.');
    }
    return null;
  }

  const headerToken = request.headers.get(HEADER_NAME) ?? '';
  const queryToken = request.nextUrl.searchParams.get(QUERY_NAME) ?? '';

  if (headerToken && timingSafeEqual(headerToken, secret)) return null;
  if (queryToken && timingSafeEqual(queryToken, secret)) return null;

  return unauthorized('missing or invalid dev-kit token', 401);
}

/**
 * Convenience matcher. Tests whether a pathname belongs to the dashboard
 * or its backing API. Keeps the path-matching logic in one place.
 */
export function isDevKitPath(pathname: string): boolean {
  return pathname.startsWith('/dev-kit') || pathname.startsWith('/api/dev-kit');
}
