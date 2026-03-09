import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("org_members")
    .select("role, organizations(name)")
    .eq("user_id", user.id)
    .single();

  const orgName =
    member?.organizations &&
    !Array.isArray(member.organizations) &&
    member.organizations.name
      ? member.organizations.name
      : "Your org";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav email={user.email ?? ""} orgName={orgName} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
