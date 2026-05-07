import { NextRequest, NextResponse } from "next/server";
import { getDocContent } from "@/lib/docs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const doc = getDocContent(slugPath);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(doc.content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
