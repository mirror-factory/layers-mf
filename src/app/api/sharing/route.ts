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

// --- POST: share an item ---

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUserAndOrg();
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { user } = auth;

  const body = await request.json();
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
