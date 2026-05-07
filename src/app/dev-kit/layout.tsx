/**
 * Dashboard Layout
 * ================
 * Root layout for the /dev-kit dashboard. Provides a persistent sidebar
 * navigation on the left with links to all dashboard sections, and renders
 * the active page in the main content area on the right.
 *
 * This is a React Server Component -- no client-side JS is shipped for the
 * layout itself.  Individual pages opt into 'use client' where interactivity
 * is needed.
 *
 * Sidebar sections:
 *   Overview | Runs | Sessions | Registries | Design system | Config |
 *   Status | Tools | Evaluations | Cost | Deployments | Regressions |
 *   Connectors | Coverage
 */

import Link from "next/link";
import {
  LayoutDashboard,
  Activity,
  Wrench,
  FlaskConical,
  DollarSign,
  Rocket,
  Bug,
  Plug,
  Shield,
  Play,
  Library,
  Palette,
  Gauge,
  Settings,
  Network,
  Package,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dev-kit", icon: LayoutDashboard },
  { label: "Index", href: "/dev-kit/index", icon: Network },
  { label: "Features", href: "/dev-kit/features", icon: Package },
  { label: "Runs", href: "/dev-kit/runs", icon: Play },
  { label: "Sessions", href: "/dev-kit/sessions", icon: Activity },
  { label: "Registries", href: "/dev-kit/registries", icon: Library },
  { label: "Design system", href: "/dev-kit/design-system", icon: Palette },
  { label: "Dependencies", href: "/dev-kit/dependencies", icon: ShieldAlert },
  { label: "Config", href: "/dev-kit/config", icon: Settings },
  { label: "Status", href: "/dev-kit/status", icon: Gauge },
  { label: "Tools", href: "/dev-kit/tools", icon: Wrench },
  { label: "Evaluations", href: "/dev-kit/evals", icon: FlaskConical },
  { label: "Cost", href: "/dev-kit/cost", icon: DollarSign },
  { label: "Deployments", href: "/dev-kit/deployments", icon: Rocket },
  { label: "Regressions", href: "/dev-kit/regressions", icon: Bug },
  { label: "Connectors", href: "/dev-kit/connectors", icon: Plug },
  { label: "Coverage", href: "/dev-kit/coverage", icon: Shield },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#050505] text-[#f0f0f0]">
      {/* ---- Sidebar ---- */}
      <aside className="w-60 shrink-0 border-r border-white/10 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/10">
          <span className="text-sm font-semibold tracking-wide text-[#3dffc0]">
            ai-dev-kit
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm
                         text-[#f0f0f0]/70 hover:text-[#f0f0f0] hover:bg-white/5
                         transition-colors"
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 text-xs text-[#f0f0f0]/40">
          @mirror-factory/ai-dev-kit
        </div>
      </aside>

      {/* ---- Main content ---- */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
