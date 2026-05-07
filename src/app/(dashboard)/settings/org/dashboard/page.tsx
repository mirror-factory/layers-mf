export const metadata = { title: "Organization Dashboard" };

import { createClient } from "@/lib/supabase/server";
import { OrgDashboard } from "@/components/org-dashboard";

export default async function OrgDashboardPage() {
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
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Organization overview, usage, and activity.
        </p>
      </div>
      <OrgDashboard />
    </div>
  );
}
