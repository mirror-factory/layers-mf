import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/skills/search?q=react
 * Proxies the skills.sh search API to avoid CORS issues when called from the browser.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ skills: [] });
  }

  try {
    const res = await fetch(
      `https://skills.sh/api/search?q=${encodeURIComponent(q)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ skills: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ skills: [] });
  }
}
