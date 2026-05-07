import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Tables not yet in generated types — use untyped access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

// --- Helpers ---

async function getAuthenticatedUserAndOrg() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;

  return { user, orgId: member.org_id, supabase };
}

// --- Schemas ---

const shareSchema = z.object({
  type: z.enum(["conversation", "context", "skill"]),
  itemId: z.string().uuid(),
  accessLevel: z.enum(["view", "edit"]).default("view"),
});

const contentShareSchema = z.object({
  contentId: z.string().uuid(),
  contentType: z.enum(["context_item", "artifact"]),
  sharedWith: z.string().uuid(),
  permission: z.enum(["viewer", "editor", "owner"]).default("viewer"),
});

// New content_shares table schema (from 20260415 migration)
const resourceShareSchema = z.object({
  resource_type: z.enum(["artifact", "conversation", "context_item", "collection"]),
  resource_id: z.string().uuid(),
  shared_with_user_id: z.string().uuid().optional().nullable(),
  scope: z.enum(["user", "org"]),
  permission: z.enum(["view", "edit", "admin"]),
});

const deleteSchema = z.object({
  type: z.enum(["conversation", "context", "skill"]),
  itemId: z.string().uuid(),
});

// --- GET: list shared items for the user's org ---

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { user, orgId } = auth;
  const adminDb = createAdminClient() as unknown as AnyDb;
  const typeFilter = request.nextUrl.searchParams.get("type");
  const contentId = request.nextUrl.searchParams.get("content_id");
  const mine = request.nextUrl.searchParams.get("mine");

  // --- Content shares (new content_shares table) ---
  if (contentId || mine === "true") {
    return handleContentSharesGet({ user, adminDb, contentId, mine });
  }

  // --- Legacy org-wide sharing ---

  // Shared conversations: where user shared or was shared with
  const fetchConversations = async () => {
    if (typeFilter && typeFilter !== "conversation") return [];

    const { data: shares } = await adminDb
      .from("shared_conversations")
      .select("id, conversation_id, shared_by, shared_with, created_at")
      .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`);

    if (!shares?.length) return [];

    const convIds = [...new Set(shares.map((s: { conversation_id: string }) => s.conversation_id))];
    const { data: conversations } = await adminDb
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .in("id", convIds);

    const userIds = [...new Set(shares.map((s: { shared_by: string }) => s.shared_by))];
    const { data: profiles } = await adminDb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    type Profile = { id: string; display_name: string | null; email: string | null };
    type Conv = { id: string; title: string | null };
    const profileMap = new Map<string, Profile>(
      (profiles ?? []).map((p: Profile) => [p.id, p] as [string, Profile])
    );
    const convMap = new Map<string, Conv>(
      (conversations ?? []).map((c: Conv) => [c.id, c] as [string, Conv])
    );

    return shares.map((s: { id: string; conversation_id: string; shared_by: string; shared_with: string; created_at: string }) => {
      const conv = convMap.get(s.conversation_id);
      const sharer = profileMap.get(s.shared_by);
      return {
        shareId: s.id,
        type: "conversation" as const,
        itemId: s.conversation_id,
        title: conv?.title ?? "Untitled conversation",
        sharedBy: sharer?.display_name ?? sharer?.email ?? "Unknown",
        sharedById: s.shared_by,
        sharedDate: s.created_at,
        accessLevel: "view",
        isOwner: s.shared_by === user.id,
      };
    });
  };

  // Shared context items: all context items in the org
  const fetchContext = async () => {
    if (typeFilter && typeFilter !== "context") return [];

    const { data: items } = await adminDb
      .from("context_items")
      .select("id, title, source_type, content_type, ingested_at, status")
      .eq("org_id", orgId)
      .eq("status", "ready")
      .order("ingested_at", { ascending: false })
      .limit(100);

    return (items ?? []).map((item: { id: string; title: string; source_type: string; content_type: string | null; ingested_at: string }) => ({
      type: "context" as const,
      itemId: item.id,
      title: item.title,
      sourceType: item.source_type,
      contentType: item.content_type,
      sharedDate: item.ingested_at,
      sharedBy: "Team",
      accessLevel: "view",
    }));
  };

  // Shared skills: all active skills in the org
  const fetchSkills = async () => {
    if (typeFilter && typeFilter !== "skill") return [];

    const { data: skills } = await adminDb
      .from("skills")
      .select("id, slug, name, description, author, category, is_active, created_at")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    return (skills ?? []).map((skill: { id: string; slug: string; name: string; description: string; author: string | null; category: string; created_at: string }) => ({
      type: "skill" as const,
      itemId: skill.id,
      title: skill.name,
      slug: skill.slug,
      description: skill.description,
      author: skill.author ?? "Team",
      category: skill.category,
      sharedDate: skill.created_at,
      accessLevel: "view",
    }));
  };

  const [conversations, context, skills] = await Promise.all([
    fetchConversations(),
    fetchContext(),
    fetchSkills(),
  ]);

  return NextResponse.json({ conversations, context, skills });
}

// --- Content shares GET handler ---

async function handleContentSharesGet({
  user,
  adminDb,
  contentId,
  mine,
}: {
  user: { id: string };
  adminDb: AnyDb;
  contentId: string | null;
  mine: string | null;
}) {
  // If content_id provided, list shares for that specific content
  if (contentId) {
    const { data: shares, error } = await adminDb
      .from("content_shares")
      .select("id, content_id, content_type, shared_by, shared_with, permission, created_at")
      .eq("content_id", contentId)
      .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`);

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    // Enrich with profile data
    const userIds = [
      ...new Set([
        ...(shares ?? []).map((s: { shared_by: string }) => s.shared_by),
        ...(shares ?? []).map((s: { shared_with: string }) => s.shared_with),
      ]),
    ];

    const { data: profiles } = await adminDb
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", userIds);

    type Profile = { id: string; display_name: string | null; email: string | null; avatar_url: string | null };
    const profileMap = new Map<string, Profile>(
      (profiles ?? []).map((p: Profile) => [p.id, p] as [string, Profile])
    );

    const enriched = (shares ?? []).map((s: { id: string; content_id: string; content_type: string; shared_by: string; shared_with: string; permission: string; created_at: string }) => ({
      ...s,
      sharedByProfile: profileMap.get(s.shared_by) ?? null,
      sharedWithProfile: profileMap.get(s.shared_with) ?? null,
    }));

    return NextResponse.json({ shares: enriched });
  }

  // If mine=true, list all items shared with current user
  if (mine === "true") {
    const { data: shares, error } = await adminDb
      .from("content_shares")
      .select("id, content_id, content_type, shared_by, shared_with, permission, created_at")
      .eq("shared_with", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    if (!shares?.length) {
      return NextResponse.json({ shares: [], items: [] });
    }

    // Separate by content_type
    const contextItemIds = shares
      .filter((s: { content_type: string }) => s.content_type === "context_item")
      .map((s: { content_id: string }) => s.content_id);
    const artifactIds = shares
      .filter((s: { content_type: string }) => s.content_type === "artifact")
      .map((s: { content_id: string }) => s.content_id);

    // Fetch context items
    const { data: contextItems } = contextItemIds.length
      ? await adminDb
          .from("context_items")
          .select("id, title, source_type, content_type, ingested_at, status, description_short")
          .in("id", contextItemIds)
      : { data: [] };

    // Fetch artifacts (if table exists)
    let artifacts: { id: string; title: string }[] = [];
    if (artifactIds.length) {
      const { data } = await adminDb
        .from("artifacts")
        .select("id, title")
        .in("id", artifactIds);
      artifacts = data ?? [];
    }

    // Fetch sharer profiles
    const sharerIds = [...new Set(shares.map((s: { shared_by: string }) => s.shared_by))];
    const { data: profiles } = await adminDb
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", sharerIds);

    type Profile = { id: string; display_name: string | null; email: string | null; avatar_url: string | null };
    const profileMap = new Map<string, Profile>(
      (profiles ?? []).map((p: Profile) => [p.id, p] as [string, Profile])
    );

    type ContextItemRow = { id: string; title: string; source_type: string; content_type: string; ingested_at: string; status: string; description_short: string | null };
    const contextMap = new Map<string, ContextItemRow>(
      (contextItems ?? []).map((c: ContextItemRow) => [c.id, c] as [string, ContextItemRow])
    );
    const artifactMap = new Map<string, { id: string; title: string }>(
      artifacts.map((a) => [a.id, a])
    );

    const enriched = shares.map((s: { id: string; content_id: string; content_type: string; shared_by: string; permission: string; created_at: string }) => {
      const sharer = profileMap.get(s.shared_by);
      const contextItem = contextMap.get(s.content_id);
      const artifact = artifactMap.get(s.content_id);

      return {
        shareId: s.id,
        contentId: s.content_id,
        contentType: s.content_type,
        permission: s.permission,
        sharedBy: sharer?.display_name ?? sharer?.email ?? "Unknown",
        sharedByAvatar: sharer?.avatar_url ?? null,
        sharedDate: s.created_at,
        // Inline the item data
        title: contextItem?.title ?? artifact?.title ?? "Untitled",
        sourceType: contextItem?.source_type ?? null,
        itemContentType: contextItem?.content_type ?? null,
        status: contextItem?.status ?? null,
        descriptionShort: contextItem?.description_short ?? null,
        ingestedAt: contextItem?.ingested_at ?? null,
      };
    });

    return NextResponse.json({ shares: enriched });
  }

  return NextResponse.json({ shares: [] });
}

// --- POST: share an item ---

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { user } = auth;
  const body = await request.json();

  // Try content_shares schema first (new system)
  const contentParsed = contentShareSchema.safeParse(body);
  if (contentParsed.success) {
    const { contentId, contentType, sharedWith, permission } = contentParsed.data;

    if (sharedWith === user.id) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    const adminDb = createAdminClient() as unknown as AnyDb;

    const { data, error } = await adminDb
      .from("content_shares")
      .upsert(
        {
          content_id: contentId,
          content_type: contentType,
          shared_by: user.id,
          shared_with: sharedWith,
          permission,
        },
        { onConflict: "content_id,content_type,shared_with" }
      )
      .select("id, content_id, content_type, shared_by, shared_with, permission, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    // Fire-and-forget: notify the recipient about the share
    (async () => {
      try {
        const { notify } = await import("@/lib/notifications/notify");
        // Get sharer profile for a nice title
        const sharerDb = createAdminClient() as unknown as AnyDb;
        const { data: profile } = await sharerDb
          .from("profiles")
          .select("display_name, email")
          .eq("id", user.id)
          .single();
        const sharerName = profile?.display_name ?? profile?.email ?? "Someone";

        // Try to get item title
        let resourceTitle = "an item";
        if (contentType === "context_item") {
          const { data: item } = await sharerDb
            .from("context_items")
            .select("title")
            .eq("id", contentId)
            .single();
          if (item?.title) resourceTitle = item.title;
        } else if (contentType === "artifact") {
          const { data: item } = await sharerDb
            .from("artifacts")
            .select("title")
            .eq("id", contentId)
            .single();
          if (item?.title) resourceTitle = item.title;
        }

        // Get org_id for the recipient notification
        const { data: recipientMember } = await sharerDb
          .from("org_members")
          .select("org_id")
          .eq("user_id", sharedWith)
          .single();

        if (recipientMember) {
          await notify({
            userId: sharedWith,
            orgId: recipientMember.org_id,
            type: "share",
            title: `${sharerName} shared "${resourceTitle}" with you`,
            body: `You have ${permission} access.`,
            link:
              contentType === "context_item"
                ? `/context/${contentId}`
                : `/artifacts/${contentId}`,
            metadata: {
              content_type: contentType,
              content_id: contentId,
              shared_by: user.id,
            },
          });
        }
      } catch {
        /* silent -- notification is best-effort */
      }
    })();

    return NextResponse.json({ share: data }, { status: 201 });
  }

  // Try resource share schema (content_shares table from 20260415 migration)
  const resourceParsed = resourceShareSchema.safeParse(body);
  if (resourceParsed.success) {
    const { resource_type, resource_id, shared_with_user_id, scope, permission } = resourceParsed.data;

    if (shared_with_user_id && shared_with_user_id === user.id) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    if (scope === "user" && !shared_with_user_id) {
      return NextResponse.json(
        { error: "shared_with_user_id is required when scope is 'user'" },
        { status: 400 }
      );
    }

    const adminDb = createAdminClient() as unknown as AnyDb;

    const { data: resourceShare, error: resourceError } = await adminDb
      .from("content_shares")
      .insert({
        resource_type,
        resource_id,
        shared_with_user_id: shared_with_user_id ?? null,
        scope,
        permission,
        shared_by: user.id,
        org_id: auth.orgId,
      })
      .select("id, resource_type, resource_id, shared_with_user_id, scope, permission, shared_by, org_id, created_at")
      .single();

    if (resourceError) {
      return NextResponse.json({ error: (resourceError as { message: string }).message }, { status: 500 });
    }

    return NextResponse.json({ share: resourceShare }, { status: 201 });
  }

  // Fall back to legacy share schema
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { type, itemId, accessLevel } = parsed.data;
  const adminDb = createAdminClient() as unknown as AnyDb;

  if (type === "conversation") {
    // Get all org members except the current user
    const { data: members } = await adminDb
      .from("org_members")
      .select("user_id")
      .eq("org_id", auth.orgId)
      .neq("user_id", user.id);

    if (!members?.length) {
      return NextResponse.json({ error: "No team members to share with" }, { status: 400 });
    }

    const rows = members.map((m: { user_id: string }) => ({
      conversation_id: itemId,
      shared_by: user.id,
      shared_with: m.user_id,
    }));

    const { error } = await adminDb
      .from("shared_conversations")
      .upsert(rows, { onConflict: "conversation_id,shared_with" });

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    return NextResponse.json({ shared: true, type, itemId, accessLevel });
  }

  // Context and skills are org-wide by default, just acknowledge
  return NextResponse.json({ shared: true, type, itemId, accessLevel });
}

// --- DELETE: unshare an item ---

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { user } = auth;

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { type, itemId } = parsed.data;
  const adminDb = createAdminClient() as unknown as AnyDb;

  if (type === "conversation") {
    const { error } = await adminDb
      .from("shared_conversations")
      .delete()
      .eq("conversation_id", itemId)
      .eq("shared_by", user.id);

    if (error) {
      return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
    }

    return NextResponse.json({ unshared: true });
  }

  return NextResponse.json({ unshared: true });
}
