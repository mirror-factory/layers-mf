export const metadata = { title: "Profile Settings" };

import { createClient } from "@/lib/supabase/server";
import { ProfileSettings } from "@/components/profile-settings";
import { PageExplainer } from "@/components/page-explainer";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account settings and password.
        </p>
      </div>
      <PageExplainer
        title="How Profile Settings Work"
        sections={[
          { title: "Display Name", content: "Your display name is shown to teammates in comments, mentions, and shared conversations." },
          { title: "Password", content: "Update your password at any time. You must confirm your current password before setting a new one." },
          { title: "Account Info", content: "Your email is tied to your login. Contact support if you need to change your primary email address." },
        ]}
      />
      <ProfileSettings
        email={user.email ?? ""}
        displayName={user.user_metadata?.display_name ?? ""}
      />
    </div>
  );
}
