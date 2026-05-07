import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PermissionSettings } from "@/components/permission-settings";
import { PageExplainer } from "@/components/page-explainer";

export default async function PermissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">
          Tool Permissions
        </h1>
        <p className="text-muted-foreground text-sm">
          Control which services the AI agent can access on your behalf.
          Write actions always go through the approval queue.
        </p>
      </div>
      <PageExplainer
        title="How Permissions Work"
        sections={[
          { title: "Read vs Write", content: "Read permissions let the AI view data from a service. Write permissions let it create or modify resources." },
          { title: "Tool Access", content: "Each tool maps to a specific service action. Disable individual tools to limit what the agent can do." },
          { title: "Approval Queue", content: "All write actions require your explicit approval before they execute, regardless of permission settings." },
        ]}
      />
      <PermissionSettings />
    </div>
  );
}
