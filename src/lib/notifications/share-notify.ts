import { createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

export async function notifyShare(params: {
  sharedBy: string;
  sharedWithUserId: string;
  resourceType: string;
  resourceId: string;
  resourceTitle: string;
  orgId: string;
}) {
  try {
    const supabase = createAdminClient() as unknown as AnyDb;

    // Get sharer's name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", params.sharedBy)
      .single();

    const sharerName = profile?.full_name || profile?.email || "Someone";

    await supabase.from("notifications").insert({
      org_id: params.orgId,
      user_id: params.sharedWithUserId,
      type: "content_shared",
      title: `${sharerName} shared a ${params.resourceType} with you`,
      body: params.resourceTitle,
      link: `/${params.resourceType === "conversation" ? "chat" : params.resourceType === "artifact" ? "artifacts" : "context"}/${params.resourceId}`,
      metadata: {
        shared_by: params.sharedBy,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
      },
    });
  } catch {
    // Never let notifications break sharing
  }
}
