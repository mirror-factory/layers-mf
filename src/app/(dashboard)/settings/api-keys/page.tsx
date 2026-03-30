import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PartnerSettings } from "@/components/partner-settings";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load existing partner settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partner_settings table pending DB types regeneration
  const { data: settings } = await (supabase as any)
    .from("partner_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Load existing credentials (provider + metadata only, not tokens)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- credentials table pending DB types regeneration
  const { data: credentials } = await (supabase as any)
    .from("credentials")
    .select("provider, expires_at, created_at, updated_at")
    .eq("user_id", user.id);

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">
          API Keys & Integrations
        </h1>
        <p className="text-muted-foreground text-sm">
          Connect your tools to Granger. API keys are encrypted and stored
          securely.
        </p>
      </div>
      <PartnerSettings
        settings={settings}
        credentials={credentials ?? []}
      />
    </div>
  );
}
