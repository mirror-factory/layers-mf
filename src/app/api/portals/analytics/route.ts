import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsEvent {
  share_token: string;
  session_id: string;
  event_type:
    | "page_view"
    | "doc_open"
    | "chat_message"
    | "tool_use"
    | "voice_activated"
    | "session_start"
    | "session_end";
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// POST — Record analytics events from portal viewer
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: AnalyticsEvent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { share_token, session_id, event_type, payload } = body;

  if (!share_token || !session_id || !event_type) {
    return NextResponse.json(
      { error: "Missing required fields: share_token, session_id, event_type" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify portal exists (lightweight check)
  const { data: portal } = await supabase
    .from("document_portals")
    .select("id")
    .eq("share_token", share_token)
    .eq("is_public", true)
    .single();

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Insert analytics event
  const { error } = await supabase.from("portal_analytics").insert({
    portal_id: portal.id,
    session_id,
    event_type,
    payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Table might not exist yet — fail gracefully
    console.error("Portal analytics insert error:", error.message);
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}

// ---------------------------------------------------------------------------
// GET — Retrieve analytics for a portal (sender dashboard)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get("portal_id");

  if (!portalId) {
    return NextResponse.json(
      { error: "Missing portal_id parameter" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Fetch all events for this portal
  const { data: events, error } = await supabase
    .from("portal_analytics")
    .select("*")
    .eq("portal_id", portalId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate into summary
  const sessions = new Map<
    string,
    {
      start: string;
      end: string;
      pages_viewed: Set<number>;
      docs_opened: Set<string>;
      messages_sent: number;
      tools_used: string[];
      voice_used: boolean;
    }
  >();

  for (const event of events ?? []) {
    const sid = event.session_id;
    if (!sessions.has(sid)) {
      sessions.set(sid, {
        start: event.created_at,
        end: event.created_at,
        pages_viewed: new Set(),
        docs_opened: new Set(),
        messages_sent: 0,
        tools_used: [],
        voice_used: false,
      });
    }
    const session = sessions.get(sid)!;
    session.end = event.created_at;

    const payload = event.payload as Record<string, unknown>;

    switch (event.event_type) {
      case "page_view":
        if (typeof payload.page === "number") {
          session.pages_viewed.add(payload.page);
        }
        break;
      case "doc_open":
        if (typeof payload.title === "string") {
          session.docs_opened.add(payload.title);
        }
        break;
      case "chat_message":
        session.messages_sent++;
        break;
      case "tool_use":
        if (typeof payload.tool === "string") {
          session.tools_used.push(payload.tool);
        }
        break;
      case "voice_activated":
        session.voice_used = true;
        break;
    }
  }

  const summary = {
    total_sessions: sessions.size,
    total_events: events?.length ?? 0,
    sessions: [...sessions.entries()].map(([id, s]) => ({
      session_id: id,
      started_at: s.start,
      ended_at: s.end,
      duration_seconds: Math.round(
        (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000
      ),
      pages_viewed: [...s.pages_viewed].sort((a, b) => a - b),
      docs_opened: [...s.docs_opened],
      messages_sent: s.messages_sent,
      tools_used: s.tools_used,
      voice_used: s.voice_used,
    })),
  };

  return NextResponse.json(summary);
}
