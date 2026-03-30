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
  Users,
  UserCog,
  Shield,
  Bell,
  CreditCard,
  Key,
  Menu,
  X,
  Coins,
  CheckSquare,
  ChevronDown,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const MAIN_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/context", label: "Context Library", icon: Library },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

const CONNECT_ITEMS: NavItem[] = [
  { href: "/integrations", label: "Integrations", icon: Plug },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings/api-keys", label: "API Keys", icon: Key },
  { href: "/settings/profile", label: "Profile", icon: UserCog },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/audit", label: "Audit Log", icon: Shield },
];

function NavLink({ href, label, icon: Icon, pathname }: NavItem & { pathname: string }) {
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
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
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
      {children}
    </p>
  );
}

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Auto-expand "More" section when a route within it is active
  useEffect(() => {
    if (MORE_ITEMS.some((item) => pathname === item.href)) {
      setMoreOpen(true);
    }
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

  const renderItems = (items: NavItem[]) =>
    items.map((item) => <NavLink key={item.href} {...item} pathname={pathname} />);

  return (
    <>
      {/* Mobile header bar */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Granger</span>
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
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Granger</span>
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
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {/* Main */}
          <SectionLabel>Main</SectionLabel>
          {renderItems(MAIN_ITEMS)}

          {/* Connect */}
          <SectionLabel>Connect</SectionLabel>
          {renderItems(CONNECT_ITEMS)}

          {/* Settings */}
          <SectionLabel>Settings</SectionLabel>
          {renderItems(SETTINGS_ITEMS)}

          {/* More (collapsible) */}
          <SectionLabel>
            <button
              onClick={() => setMoreOpen((prev) => !prev)}
              className="flex w-full items-center gap-1 uppercase tracking-wider hover:text-muted-foreground transition-colors"
            >
              More
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  moreOpen && "rotate-180"
                )}
              />
            </button>
          </SectionLabel>
          {moreOpen && renderItems(MORE_ITEMS)}
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

          {/* Super-admin link */}
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === "/admin"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>

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
