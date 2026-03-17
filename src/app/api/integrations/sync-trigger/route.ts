import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string, provider: string;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider;
    if (!connectionId || !provider) throw new Error("missing");
  } catch {
    return NextResponse.json(
      { error: "connectionId and provider required" },
      { status: 400 }
    );
  }

  // Verify the integration belongs to the user's org (RLS scoped)
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  try {
    // Trigger an immediate one-off execution of all syncs for this connection.
    // Pass an empty syncs array so Nango triggers all applicable syncs.
    await nango.triggerSync(provider, [], connectionId);

    return NextResponse.json(
      {
        status: "triggered",
        message: "Sync will complete in the background",
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("[sync-trigger] Nango triggerSync failed:", err);

    // Fall back: invoke the existing streaming sync endpoint internally
    try {
      const origin = request.nextUrl.origin;
      const fallbackRes = await fetch(`${origin}/api/integrations/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ connectionId, provider }),
      });

      if (fallbackRes.ok) {
        return NextResponse.json(
          {
            status: "triggered",
            message:
              "Background trigger unavailable; streaming sync started as fallback",
            fallback: true,
          },
          { status: 202 }
        );
      }

      return NextResponse.json(
        {
          error: "Sync trigger failed and fallback also failed",
          detail: `Fallback returned ${fallbackRes.status}`,
        },
        { status: 502 }
      );
    } catch (fallbackErr) {
      const msg =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return NextResponse.json(
        { error: "Sync trigger failed", detail: msg },
        { status: 502 }
      );
    }
  }
}
