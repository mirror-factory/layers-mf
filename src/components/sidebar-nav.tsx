"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Home,
  Library,
  MessageSquare,
  Inbox,
  Plug,
  BarChart3,
  LogOut,
  Layers,
  FolderKanban,
  Users,
  UserCog,
  Shield,
  Bell,
  CreditCard,
  SlidersHorizontal,
  FileCode2,
  CheckSquare,
  Menu,
  X,
  Coins,
  Building,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/context", label: "Context Library", icon: Library },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/sessions", label: "Sessions", icon: FolderKanban },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/actions", label: "Actions", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/org", label: "Organization", icon: Building },
  { href: "/settings/profile", label: "Profile", icon: UserCog },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/source-trust", label: "Source Trust", icon: SlidersHorizontal },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/audit", label: "Audit Log", icon: Shield },
  { href: "/features", label: "Features", icon: Layers },
  { href: "/api-docs", label: "API Docs", icon: FileCode2 },
];

export function SidebarNav({
  email,
  orgName,
}: {
  email: string;
  orgName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Fetch credit balance
  useEffect(() => {
    fetch("/api/billing/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.credits != null) setCredits(data.credits);
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile header bar */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Layers className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Layers</span>
      </div>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r bg-card transition-transform duration-200 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Layers</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Org name */}
        <div className="px-4 py-3 border-b">
          <p className="text-xs text-muted-foreground">Organization</p>
          <p className="text-sm font-medium truncate">{orgName}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t p-3 space-y-1">
          <p className="text-xs text-muted-foreground truncate mb-2">{email}</p>

          {/* Credit balance */}
          {credits !== null && (
            <Link
              href="/settings/billing"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                credits < 10
                  ? "text-red-500"
                  : credits < 50
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
            >
              <Coins className="h-4 w-4" />
              <span>{credits.toLocaleString()} credits</span>
              {credits < 10 && (
                <span className="ml-auto text-xs font-medium">Upgrade</span>
              )}
            </Link>
          )}

          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
