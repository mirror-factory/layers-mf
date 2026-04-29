import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  contextItemToMarkdown,
  itemsToMarkdown,
  sessionToMarkdown,
} from "@/lib/export";
import { searchContext } from "@/lib/db/search";

const EXPORT_FIELDS =
  "id, title, description_short, description_long, raw_content, source_type, content_type, entities, ingested_at";

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** GET — legacy: export all items as JSON or CSV. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  const { data: items, error } = await supabase
    .from("context_items")
    .select("title, source_type, content_type, description_short, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response("Failed to fetch context items", { status: 500 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "json";

  if (format === "csv") {
    const headers = [
      "title",
      "source_type",
      "content_type",
      "description_short",
      "created_at",
    ];
    const rows = (items ?? []).map((item) =>
      headers
        .map((h) => {
          const val = String(item[h as keyof typeof item] ?? "");
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=context-export.csv",
      },
    });
  }

  return Response.json(items ?? []);
}

/** POST — export specific items, a session, or search results. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const format: string = body.format ?? "markdown";
  const itemIds: string[] | undefined = body.items;
  const sessionId: string | undefined = body.sessionId;
  const query: string | undefined = body.query;
  const limit: number = Math.min(Math.max(body.limit ?? 20, 1), 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exportItems: any[] = [];
  let exportTitle = "Layers Export";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sessionData: { name: string; goal: string | null; status: string } | null = null;

  if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
    // Export specific items by ID
    const { data, error } = await supabase
      .from("context_items")
      .select(EXPORT_FIELDS)
      .eq("org_id", member.org_id)
      .in("id", itemIds);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch items" },
        { status: 500 },
      );
    }
    exportItems = data ?? [];
    exportTitle = `Layers Export — ${exportItems.length} item${exportItems.length !== 1 ? "s" : ""}`;
  } else if (sessionId) {
    // Export all items linked to a session
    const { data: session } = await supabase
      .from("sessions")
      .select("id, name, goal, status")
      .eq("id", sessionId)
      .eq("org_id", member.org_id)
      .single();

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    sessionData = session;

    const { data: links } = await supabase
      .from("session_context_links")
      .select("context_item_id")
      .eq("session_id", sessionId);

    const linkedIds = (links ?? []).map((l) => l.context_item_id);

    if (linkedIds.length > 0) {
      const { data } = await supabase
        .from("context_items")
        .select(EXPORT_FIELDS)
        .eq("org_id", member.org_id)
        .in("id", linkedIds);
      exportItems = data ?? [];
    }

    exportTitle = `Session: ${session.name}`;
  } else if (query && typeof query === "string" && query.trim().length > 0) {
    // Export search results
    const results = await searchContext(
      supabase,
      member.org_id,
      query.trim(),
      limit,
    );

    if (results.length > 0) {
      const resultIds = results.map((r) => r.id);
      const { data } = await supabase
        .from("context_items")
        .select(EXPORT_FIELDS)
        .eq("org_id", member.org_id)
        .in("id", resultIds);
      exportItems = data ?? [];
    }

    exportTitle = `Search: "${query.trim()}"`;
  } else {
    return NextResponse.json(
      {
        error:
          "Provide one of: items (array of IDs), sessionId, or query",
      },
      { status: 400 },
    );
  }

  const filename = `layers-export-${dateStamp()}`;

  if (format === "markdown") {
    let markdown: string;

    if (sessionData) {
      markdown = sessionToMarkdown(sessionData, exportItems);
    } else {
      markdown = itemsToMarkdown(exportItems, exportTitle);
    }

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  // JSON format
  const jsonExport = {
    title: exportTitle,
    exportedAt: new Date().toISOString(),
    itemCount: exportItems.length,
    ...(sessionData ? { session: sessionData } : {}),
    items: exportItems,
  };

  return new Response(JSON.stringify(jsonExport, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}
