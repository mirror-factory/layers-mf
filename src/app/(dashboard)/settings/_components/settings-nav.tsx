"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_SECTIONS = [
  {
    label: "Account",
    items: [
      { href: "/settings/profile", label: "Profile", icon: User },
      { href: "/settings/team", label: "Team", icon: Users },
      { href: "/settings/org", label: "Organization", icon: Building2 },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/settings/api-keys", label: "API Keys", icon: Key },
      { href: "/settings/permissions", label: "Permissions", icon: Shield },
    ],
  },
  {
    label: "Integrations",
    items: [
      { href: "/settings/integrations", label: "Chat SDK", icon: Zap },
      { href: "/settings/source-trust", label: "Source Trust", icon: Scale },
    ],
  },
  {
    label: "Preferences",
    items: [
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/billing", label: "Billing", icon: CreditCard },
      { href: "/settings/audit", label: "Audit Log", icon: FileSearch },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full md:w-48 shrink-0">
      <h2 className="text-lg font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 px-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
