export const metadata = { title: "Organization Settings" };

import { createClient } from "@/lib/supabase/server";
import { OrgSettings } from "@/components/org-settings";
import { PageExplainer } from "@/components/page-explainer";

export default async function OrgSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Organization</h1>
        <p className="text-muted-foreground text-sm">
          Manage your organization settings and details.
        </p>
      </div>
      <PageExplainer
        title="How Organization Settings Work"
        sections={[
          { title: "Org Name", content: "Your organization name appears in the sidebar and is visible to all members. Only owners can change it." },
          { title: "Invite Links", content: "Generate a shareable invite link to onboard new teammates. Links can be revoked at any time." },
          { title: "Danger Zone", content: "Deleting an organization removes all data, members, and integrations permanently." },
        ]}
      />
      <OrgSettings isOwner={member.role === "owner"} />
    </div>
  );
}
