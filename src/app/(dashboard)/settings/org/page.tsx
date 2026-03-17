export const metadata = { title: "Organization Settings" };

import { createClient } from "@/lib/supabase/server";
import { OrgSettings } from "@/components/org-settings";

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
      <OrgSettings isOwner={member.role === "owner"} />
    </div>
  );
}
