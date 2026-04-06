export const metadata = { title: "Organization Rules" };

import { createClient } from "@/lib/supabase/server";
import { OrgRules } from "@/components/org-rules";

export default async function OrgRulesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;

  const isOwner = member.role === "owner";
  const isAdmin = member.role === "admin" || isOwner;

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">
          Organization Rules
        </h1>
        <p className="text-muted-foreground text-sm">
          Org rules apply to all members&apos; conversations with the AI.
        </p>
      </div>
      <OrgRules canEdit={isAdmin} />
    </div>
  );
}
