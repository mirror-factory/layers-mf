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
  ChevronLeft,
  ChevronRight,
  Zap,
  Clock,
  Puzzle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const MAIN_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/context", label: "Context Library", icon: Library },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/schedules", label: "Schedules", icon: Clock },
  { href: "/skills", label: "Skills", icon: Puzzle },
];

const CONNECT_ITEMS: NavItem[] = [
  { href: "/integrations", label: "Integrations", icon: Plug },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings/api-keys", label: "API Keys", icon: Key },
  { href: "/settings/permissions", label: "Permissions", icon: Shield },
  { href: "/settings/mcp", label: "MCP Servers", icon: Plug },
  { href: "/settings/profile", label: "Profile", icon: UserCog },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/audit", label: "Audit Log", icon: Shield },
];

function NavLink({ href, label, icon: Icon, pathname, collapsed }: NavItem & { pathname: string; collapsed?: boolean }) {
  const link = (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md text-sm transition-colors",
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
        pathname === href
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      {...(collapsed ? { title: label } : {})}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
  return link;
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  if (collapsed) return null;
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
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

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
    items.map((item) => <NavLink key={item.href} {...item} pathname={pathname} collapsed={collapsed} />);

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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 md:static md:translate-x-0",
          collapsed ? "w-[48px]" : "w-56",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center border-b", collapsed ? "justify-center px-1 py-5" : "justify-between px-4 py-5")}>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {!collapsed && <span className="font-semibold text-sm">Granger</span>}
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
        {!collapsed && (
          <div className="px-4 py-3 border-b">
            <p className="text-xs text-muted-foreground">Organization</p>
            <p className="text-sm font-medium truncate">{orgName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "p-1" : "p-2")} role="navigation" aria-label="Main navigation">
          {/* Main */}
          <SectionLabel collapsed={collapsed}>Main</SectionLabel>
          {renderItems(MAIN_ITEMS)}

          {/* Connect */}
          <SectionLabel collapsed={collapsed}>Connect</SectionLabel>
          {renderItems(CONNECT_ITEMS)}

          {/* Settings */}
          <SectionLabel collapsed={collapsed}>Settings</SectionLabel>
          {renderItems(SETTINGS_ITEMS)}

          {/* More (collapsible) */}
          {!collapsed ? (
            <SectionLabel collapsed={collapsed}>
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
          ) : (
            <div className="my-2 border-t" />
          )}
          {(moreOpen || collapsed) && renderItems(MORE_ITEMS)}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden md:flex justify-center border-t py-1">
          <button
            onClick={toggleCollapsed}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* User */}
        <div className={cn("border-t space-y-1", collapsed ? "p-1" : "p-3")}>
          {!collapsed && <p className="text-xs text-muted-foreground truncate mb-2">{email}</p>}

          {/* Credit balance */}
          {credits !== null && (
            <Link
              href="/settings/billing"
              title={collapsed ? `${credits.toLocaleString()} credits` : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
                credits < 10
                  ? "text-red-500"
                  : credits < 50
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
            >
              <Coins className="h-4 w-4" />
              {!collapsed && (
                <>
                  <span>{credits.toLocaleString()} credits</span>
                  {credits < 10 && (
                    <span className="ml-auto text-xs font-medium">Upgrade</span>
                  )}
                </>
              )}
            </Link>
          )}

          {/* Super-admin link */}
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            title={collapsed ? "Admin" : undefined}
            className={cn(
              "flex items-center rounded-md text-sm transition-colors",
              collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
              pathname === "/admin"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            {!collapsed && "Admin"}
          </Link>

          {!collapsed && <ThemeToggle />}
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
              collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}
