"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Library,
  MessageSquare,
  Plug,
  BarChart3,
  LogOut,
  Shield,
  Menu,
  X,
  Coins,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Puzzle,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  Building2,
  Bell as BellIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { NeuralDots } from "@/components/ui/neural-dots";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const MAIN_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/context", label: "Library", icon: Library },
  { href: "/skills", label: "Skills", icon: Puzzle },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/schedules", label: "Scheduling", icon: Clock },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/changelog", label: "Changelog", icon: ScrollText },
  { href: "/analytics/costs", label: "Analytics", icon: BarChart3 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/org", label: "Organization", icon: Building2 },
  { href: "/settings/notifications", label: "Notifications", icon: BellIcon },
];

function NavLink({ href, label, icon: Icon, pathname, collapsed }: NavItem & { pathname: string; collapsed?: boolean }) {
  const link = (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md text-sm transition-colors",
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
        (pathname === href || (href !== "/home" && href !== "/chat" && pathname.startsWith(href + "/")))
          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      {...(collapsed ? { title: label } : {})}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
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
  const [hovered, setHovered] = useState(false);

  // Expanded by default, restore user preference
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // When hovered and collapsed, visually expand
  const isVisuallyCollapsed = collapsed && !hovered;

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
    if (MORE_ITEMS.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))) {
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
    items.map((item) => <NavLink key={item.href} {...item} pathname={pathname} collapsed={isVisuallyCollapsed} />);

  return (
    <>
      {/* Mobile header bar — offset below Dynamic Island / status bar */}
      <div className="sidebar-mobile-header sticky top-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 safe-top md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <NeuralDots size={24} dotCount={6} />
        <span className="font-display text-lg font-bold tracking-tight text-primary">Granger</span>
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0",
          isVisuallyCollapsed ? "md:w-[48px] w-full" : "md:w-56 w-full",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo + collapse toggle */}
        <div className={cn("flex items-center border-b", isVisuallyCollapsed ? "justify-center px-1 py-5" : "justify-between px-4 py-5")}>
          <div className="flex items-center gap-2">
            <NeuralDots size={24} dotCount={6} />
            {!isVisuallyCollapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-primary">Granger</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Collapse toggle (desktop only) */}
            <button
              onClick={toggleCollapsed}
              className="hidden md:inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Org name */}
        {!isVisuallyCollapsed && (
          <div className="px-4 py-3 border-b">
            <p className="text-xs text-muted-foreground">Organization</p>
            <p className="text-sm font-medium truncate">{orgName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", isVisuallyCollapsed ? "p-1" : "p-2")} role="navigation" aria-label="Main navigation">
          {renderItems(MAIN_ITEMS)}

          {/* More (collapsible) */}
          {!isVisuallyCollapsed ? (
            <SectionLabel collapsed={isVisuallyCollapsed}>
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
          {(moreOpen || isVisuallyCollapsed) && renderItems(MORE_ITEMS)}
        </nav>

        {/* User */}
        <div className={cn("border-t space-y-1", isVisuallyCollapsed ? "p-1" : "p-3")}>
          {!isVisuallyCollapsed && <p className="text-xs text-muted-foreground truncate mb-2">{email}</p>}

          {/* Notifications */}
          <NotificationBell collapsed={isVisuallyCollapsed} />

          {/* Credit balance */}
          {credits !== null && (
            <Link
              href="/settings/billing"
              title={isVisuallyCollapsed ? `${credits.toLocaleString()} credits` : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                isVisuallyCollapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
                credits < 10
                  ? "text-red-500"
                  : credits < 50
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
            >
              <Coins className="h-4 w-4" />
              {!isVisuallyCollapsed && (
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
            title={isVisuallyCollapsed ? "Admin" : undefined}
            className={cn(
              "flex items-center rounded-md text-sm transition-colors",
              isVisuallyCollapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
              pathname === "/admin"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            {!isVisuallyCollapsed && "Admin"}
          </Link>

          {!isVisuallyCollapsed && <ThemeToggle />}
          <button
            onClick={handleSignOut}
            title={isVisuallyCollapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
              isVisuallyCollapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isVisuallyCollapsed && "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}
