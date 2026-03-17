import { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export interface DigestItem {
  title: string;
  type: "new_context" | "action_item" | "decision" | "mention";
  source: string;
  priority: "urgent" | "high" | "normal" | "low";
  url: string;
}

export interface DigestData {
  userName: string;
  date: string;
  newContextCount: number;
  items: DigestItem[];
  overdueActions: DigestItem[];
}

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Generate digest data for a user.
 * Returns null if there is nothing to report (caller should skip sending).
 */
export async function generateDigestForUser(
  supabase: AnySupabase,
  userId: string,
  orgId: string
): Promise<DigestData | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Parallel queries: recent context items, unread inbox items, overdue actions, user profile
  const [contextResult, inboxResult, overdueResult, profileResult] =
    await Promise.all([
      supabase
        .from("context_items")
        .select("id, title, source_type, content_type")
        .eq("org_id", orgId)
        .eq("status", "ready")
        .gte("ingested_at", since)
        .order("ingested_at", { ascending: false })
        .limit(50),

      supabase
        .from("inbox_items")
        .select("id, title, type, priority, context_item_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("status", "unread")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("inbox_items")
        .select("id, title, context_item_id, created_at")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .eq("type", "action_item")
        .eq("status", "unread")
        .lt("created_at", since)
        .limit(20),

      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single(),
    ]);

  if (contextResult.error) throw contextResult.error;
  if (inboxResult.error) throw inboxResult.error;
  if (overdueResult.error) throw overdueResult.error;

  const contextItems = contextResult.data ?? [];
  const inboxItems = inboxResult.data ?? [];
  const overdueItems = overdueResult.data ?? [];

  // Nothing to report — skip digest
  if (
    contextItems.length === 0 &&
    inboxItems.length === 0 &&
    overdueItems.length === 0
  ) {
    return null;
  }

  const userName =
    profileResult.data?.full_name ??
    profileResult.data?.email ??
    "there";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Map context items into digest items
  const contextDigestItems: DigestItem[] = contextItems.map((item) => ({
    title: item.title,
    type: "new_context" as const,
    source: `${item.source_type}/${item.content_type}`,
    priority: "normal" as const,
    url: `${APP_URL}/context/${item.id}`,
  }));

  // Map inbox items into digest items (decisions, mentions, action items)
  const inboxDigestItems: DigestItem[] = inboxItems
    .filter((item) => item.type !== "new_context")
    .map((item) => ({
      title: item.title,
      type: item.type as DigestItem["type"],
      source: "inbox",
      priority: item.priority as DigestItem["priority"],
      url: `${APP_URL}/inbox`,
    }));

  // Map overdue items
  const overdueDigestItems: DigestItem[] = overdueItems.map((item) => ({
    title: item.title,
    type: "action_item" as const,
    source: "overdue",
    priority: "urgent" as const,
    url: item.context_item_id
      ? `${APP_URL}/context/${item.context_item_id}`
      : `${APP_URL}/inbox`,
  }));

  return {
    userName,
    date: today,
    newContextCount: contextItems.length,
    items: [...inboxDigestItems, ...contextDigestItems],
    overdueActions: overdueDigestItems,
  };
}
