import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ token: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortalRow = Record<string, any>;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const supabase = createAdminClient();

  // Fetch portal by share_token — no auth required
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portal, error } = await (supabase as any)
    .from("document_portals")
    .select(
      "id, title, subtitle, client_name, brand_color, brand_secondary_color, logo_url, audio_storage_path, pdf_storage_path, enabled_tools, model, hide_chrome, default_expanded, share_token, is_public, context_item_id, document_content, view_count, created_at"
    )
    .eq("share_token", token)
    .eq("is_public", true)
    .single();

  if (error || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const p = portal as PortalRow;

  // Increment view_count (good enough for analytics — no race concern)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("document_portals")
    .update({
      view_count: (p.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("id", p.id);

  // If no document_content but has context_item_id, load it
  let documentContent = p.document_content;
  if (!documentContent && p.context_item_id) {
    const { data: contextItem } = await supabase
      .from("context_items")
      .select("raw_content")
      .eq("id", p.context_item_id)
      .single();
    if (contextItem?.raw_content) {
      documentContent = contextItem.raw_content;
    }
  }

  return NextResponse.json({
    portal: {
      ...p,
      document_content: documentContent,
    },
  });
}
