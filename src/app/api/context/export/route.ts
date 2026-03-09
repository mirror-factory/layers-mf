import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const headers = ["title", "source_type", "content_type", "description_short", "created_at"];
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
