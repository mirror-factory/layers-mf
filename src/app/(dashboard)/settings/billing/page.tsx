export const metadata = { title: "Billing" };

import { createClient } from "@/lib/supabase/server";
import { BillingSettings } from "@/components/billing-settings";
import { UsageHistory } from "@/components/usage-history";
import { Separator } from "@/components/ui/separator";
import { PageExplainer } from "@/components/page-explainer";

export default async function BillingSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;

  const isOwnerOrAdmin = ["owner", "admin"].includes(member.role);

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Manage your credit balance and purchase additional credits.
        </p>
      </div>
      <PageExplainer
        title="How Billing Works"
        sections={[
          { title: "Credits", content: "Your plan includes a monthly credit allowance. Each AI call consumes credits based on model and token count." },
          { title: "Usage-Based", content: "When credits run out, additional usage is billed at per-token rates through your connected payment method." },
          { title: "Payments", content: "Billing is handled through Stripe. You can update your card, view invoices, and manage your plan here." },
        ]}
      />
      <BillingSettings isOwnerOrAdmin={isOwnerOrAdmin} />

      <Separator className="my-8" />

      <UsageHistory />
    </div>
  );
}
