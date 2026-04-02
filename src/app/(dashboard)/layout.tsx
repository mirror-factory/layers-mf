import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/sidebar-nav";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { OnboardingRedirect } from "@/components/onboarding-redirect";
import { TestingChecklist } from "@/components/testing-checklist";
import { NotificationProvider } from "@/components/notification-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

// Pages within the dashboard route group that should be publicly accessible
const PUBLIC_DASHBOARD_PATHS = ["/features"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if this is a public page within the dashboard group
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? "";
  const isPublicPage = PUBLIC_DASHBOARD_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!user && !isPublicPage) redirect("/login");

  // For unauthenticated users on public pages, render without sidebar
  if (!user && isPublicPage) {
    return (
      <div className="min-h-screen">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("role, organizations(name)")
    .eq("user_id", user!.id)
    .single();

  const orgName =
    member?.organizations &&
    !Array.isArray(member.organizations) &&
    member.organizations.name
      ? member.organizations.name
      : "Your org";

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden">
      <OnboardingRedirect />
      <SidebarNav email={user!.email ?? ""} orgName={orgName} />
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0" tabIndex={-1}>
        <div className="border-b bg-card px-4 py-2 sm:px-6 hidden md:block">
          <Breadcrumbs />
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
      <MobileBottomNav />
      <CommandPalette />
      <KeyboardShortcuts />
      <TestingChecklist />
      <NotificationProvider />
    </div>
  );
}
