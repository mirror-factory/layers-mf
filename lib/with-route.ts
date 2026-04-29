/**
 * withRoute -- standard API route wrapper.
 *
 * Every `app/api/*\/route.ts` handler should be exported wrapped in this. The
 * wrapper does four things that should be boringly universal:
 *
 *   1. Generates or reads an `x-request-id` and threads it through logs
 *      and the response header.
 *   2. Logs a structured `route.start` / `route.end` / `route.error` event
 *      to the stdout sink so failures are visible even without Langfuse /
 *      Supabase configured.
 *   3. Catches any thrown error, logs it with full context, and returns a
 *      JSON body (`{ error, requestId, traceId }`) -- never a bare string
 *      like Next.js's default "Internal Server Error".
 *   4. Records duration so p50/p95 stats work off the stdout sink alone.
 *
 * Usage:
 *   export const POST = withRoute(async (req, ctx) => {
 *     const body = await req.json();
 *     ...
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * The `ctx` argument is the standard Next.js route context plus
 * `{ requestId, startedAt }` for convenience.
 */

import { NextRequest, NextResponse } from 'next/server';
import { log, toErrObject } from './logger';

export interface RouteContext {
  requestId: string;
  startedAt: number;
  params?: Record<string, string | string[]>;
}

type Handler = (
  req: NextRequest,
  ctx: RouteContext,
) => Promise<Response> | Response;

type NextRouteContext = { params: Promise<Record<string, string | string[]>> };

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function withRoute(handler: Handler) {
  return async (req: NextRequest, nextCtx: NextRouteContext): Promise<Response> => {
    const requestId = req.headers.get('x-request-id') ?? generateRequestId();
    const startedAt = Date.now();
    const path = new URL(req.url).pathname;
    const method = req.method;

    log.info('route.start', { requestId, method, path });

    try {
      const params = nextCtx?.params ? await nextCtx.params : undefined;
      const ctx: RouteContext = { requestId, startedAt, params };
      const response = await handler(req, ctx);

      // Propagate request id on the response so clients can correlate.
      response.headers.set('x-request-id', requestId);

      log.info('route.end', {
        requestId,
        method,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errObj = toErrObject(err);
      log.error('route.error', { requestId, method, path, durationMs, err: errObj });

      return NextResponse.json(
        {
          error: errObj.message || 'Internal Server Error',
          requestId,
          // Trace id is set by OTel middleware (Langfuse) when available.
          // Missing in environments without OTel; that's fine.
          traceId: null,
        },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }
  };
}
