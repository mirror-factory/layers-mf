import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { devKitAuthGuard, isDevKitPath } from "@/lib/middleware-dev-kit";

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const incomingRequestId = request.headers.get("x-request-id");
  const requestId =
    incomingRequestId && /^[\w-]{1,64}$/.test(incomingRequestId)
      ? incomingRequestId
      : generateRequestId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (isDevKitPath(pathname)) {
    const blocked = devKitAuthGuard(request);
    if (blocked) return blocked;

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("x-pathname", pathname);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // Issue 3: Serve raw markdown when URL ends in .md (e.g. /docs/roadmap.md)
  if (pathname.startsWith("/docs/") && pathname.endsWith(".md")) {
    const slug = pathname.replace(/^\/docs\//, "").replace(/\.md$/, "");
    const url = request.nextUrl.clone();
    url.pathname = `/api/docs/${slug}`;
    return NextResponse.rewrite(url);
  }

  // Issue 4: Content negotiation — return markdown when Accept header prefers it
  if (
    pathname.startsWith("/docs/") &&
    request.headers.get("accept")?.includes("text/markdown")
  ) {
    const slug = pathname.replace(/^\/docs\//, "");
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/api/docs/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require auth
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/sprint-progress") ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/portal/");

  const isAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const isOnboardingPath = pathname.startsWith("/onboarding");

  // API routes handle auth internally — don't redirect them
  const isApiPath = pathname.startsWith("/api/");

  // Redirect unauthenticated users to login (except API routes)
  if (!user && !isAuthPath && !isPublicPath && !isApiPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow onboarding paths for authenticated users
  if (user && isOnboardingPath) {
    return supabaseResponse;
  }

  // Forward pathname to server components via header
  supabaseResponse.headers.set("x-pathname", pathname);
  supabaseResponse.headers.set("x-request-id", requestId);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|llms\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|docx|xlsx|pdf|pptx|csv|json)$).*)",
  ],
};
