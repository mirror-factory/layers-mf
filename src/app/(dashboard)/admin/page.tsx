export const metadata = { title: "Admin - Platform Configuration" };

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { AdminSettings } from "@/components/admin-settings";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSuperAdmin(user.email)) {
    redirect("/");
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">
          Platform Administration
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure pricing, credits, and view platform-wide usage stats.
        </p>
      </div>
      <AdminSettings />
    </div>
  );
}
