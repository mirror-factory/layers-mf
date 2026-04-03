import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  fetchedAt: number;
}

const TTL_MS = 1000 * 60 * 60; // 1 hour
const cache = new Map<string, LinkPreview>();

function extractMeta(html: string, property: string): string | null {
  // Try og: meta tags first
  const ogRegex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const ogMatch = html.match(ogRegex);
  if (ogMatch) return ogMatch[1];

  // Try reversed attribute order (content before property)
  const reverseRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch) return reverseMatch[1];

  return null;
}

function extractTitle(html: string): string | null {
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) return ogTitle;

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractDescription(html: string): string | null {
  return (
    extractMeta(html, "og:description") ?? extractMeta(html, "description")
  );
}

function extractImage(html: string): string | null {
  return extractMeta(html, "og:image");
}

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith("http")) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return NextResponse.json({
      title: cached.title,
      description: cached.description,
      image: cached.image,
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LayersBot/1.0 (link-preview)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${response.status}` },
        { status: 502 }
      );
    }

    // Only read the first 50KB to avoid large payloads
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 502 });
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const maxBytes = 50_000;

    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
    }
    reader.cancel();

    const html = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array())
    );

    const title = extractTitle(html);
    const description = extractDescription(html);
    const image = extractImage(html);

    // Cache the result
    const preview: LinkPreview = {
      title,
      description,
      image,
      fetchedAt: Date.now(),
    };
    cache.set(url, preview);

    // Evict old entries if cache grows too large
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (now - val.fetchedAt > TTL_MS) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ title, description, image });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch preview: ${message}` },
      { status: 502 }
    );
  }
}
