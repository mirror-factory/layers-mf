export const metadata = { title: "Settings" };

import Link from "next/link";
import {
  User,
  Users,
  Building2,
  Shield,
  Key,
  Bell,
  CreditCard,
  Zap,
  Scale,
  FileSearch,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const SETTINGS_CARDS = [
  { href: "/settings/profile", label: "Profile", description: "Display name and password", icon: User },
  { href: "/settings/team", label: "Team", description: "Manage members and roles", icon: Users },
  { href: "/settings/org", label: "Organization", description: "Org name and webhooks", icon: Building2 },
  { href: "/settings/api-keys", label: "API Keys", description: "Manage API key access", icon: Key },
  { href: "/settings/permissions", label: "Permissions", description: "Per-service tool access", icon: Shield },
  { href: "/settings/integrations", label: "Chat SDK", description: "Discord, Slack, webhooks", icon: Zap },
  { href: "/settings/source-trust", label: "Source Trust", description: "Weight context sources", icon: Scale },
  { href: "/settings/notifications", label: "Notifications", description: "Email digest preferences", icon: Bell },
  { href: "/settings/billing", label: "Billing", description: "Credits and subscription", icon: CreditCard },
  { href: "/settings/audit", label: "Audit Log", description: "Activity history", icon: FileSearch },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage your account, team, integrations, and preferences.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_CARDS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
