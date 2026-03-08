import { createClient } from "@/lib/supabase/server";
import { ProfileSettings } from "@/components/profile-settings";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account settings and password.
        </p>
      </div>
      <ProfileSettings
        email={user.email ?? ""}
        displayName={user.user_metadata?.display_name ?? ""}
      />
    </div>
  );
}
