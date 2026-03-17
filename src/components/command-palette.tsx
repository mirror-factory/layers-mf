"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Library,
  MessageSquare,
  Inbox,
  Plug,
  BarChart3,
  FolderKanban,
  Zap,
  HeartPulse,
  BookOpen,
  Sparkles,
  UserCog,
  Users,
  CreditCard,
  ClipboardList,
  ShieldCheck,
  Bell,
  Upload,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CommandEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  shortcut?: string;
}

const NAVIGATION: CommandEntry[] = [
  { href: "/", label: "Home", icon: Home, keywords: "dashboard overview", shortcut: "G H" },
  { href: "/context", label: "Context Library", icon: Library, keywords: "documents sources knowledge", shortcut: "G C" },
  { href: "/chat", label: "Chat", icon: MessageSquare, keywords: "conversation ai assistant" },
  { href: "/sessions", label: "Sessions", icon: FolderKanban, keywords: "projects workspace", shortcut: "G S" },
  { href: "/inbox", label: "Inbox", icon: Inbox, keywords: "messages notifications", shortcut: "G I" },
  { href: "/actions", label: "Actions", icon: Zap, keywords: "tasks automations" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, keywords: "metrics usage stats", shortcut: "G A" },
  { href: "/analytics/health", label: "Content Health", icon: HeartPulse, keywords: "quality freshness analytics" },
  { href: "/integrations", label: "Integrations", icon: Plug, keywords: "connect apps services" },
  { href: "/features", label: "Features", icon: Sparkles, keywords: "capabilities roadmap" },
  { href: "/api-docs", label: "API Docs", icon: BookOpen, keywords: "documentation reference endpoints" },
];

const SETTINGS: CommandEntry[] = [
  { href: "/settings/profile", label: "Profile", icon: UserCog, keywords: "account user preferences" },
  { href: "/settings/team", label: "Team", icon: Users, keywords: "members organization roles" },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, keywords: "credits subscription payments plan pricing" },
  { href: "/settings/audit", label: "Audit Log", icon: ClipboardList, keywords: "history activity events" },
  { href: "/settings/source-trust", label: "Source Trust", icon: ShieldCheck, keywords: "trust verification reliability" },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, keywords: "alerts email preferences" },
];

const ACTIONS: CommandEntry[] = [
  { href: "/context/upload-meeting", label: "Upload Document", icon: Upload, keywords: "import file meeting notes" },
  { href: "/sessions?create=true", label: "New Session", icon: PlusCircle, keywords: "start create project" },
  { href: "/integrations", label: "Connect Integration", icon: Plug, keywords: "add service app" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function renderItems(items: CommandEntry[]) {
    return items.map(({ href, label, icon: Icon, keywords, shortcut }) => (
      <CommandItem
        key={href}
        value={`${label} ${keywords ?? ""}`}
        onSelect={() => navigate(href)}
      >
        <Icon className="mr-2 h-4 w-4" />
        <span className="flex-1">{label}</span>
        {shortcut && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            {shortcut.split(" ").map((key, i) => (
              <kbd
                key={i}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[11px]"
              >
                {key}
              </kbd>
            ))}
          </span>
        )}
      </CommandItem>
    ));
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {renderItems(NAVIGATION)}
        </CommandGroup>
        <CommandGroup heading="Settings">
          {renderItems(SETTINGS)}
        </CommandGroup>
        <CommandGroup heading="Actions">
          {renderItems(ACTIONS)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
