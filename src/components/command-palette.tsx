"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Library,
  MessageSquare,
  Inbox,
  Plug,
  Coins,
  BookOpen,
  UserCog,
  CreditCard,
  FileSearch,
  Bell,
  Shield,
  Scale,
  Upload,
  PlusCircle,
  Clock,
  Puzzle,
  FileCode2,
  Terminal,
  Share2,
  FileText,
  Key,
  Zap,
  CheckSquare,
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
  { href: "/home", label: "Home", icon: Home, keywords: "dashboard overview greeting", shortcut: "G H" },
  { href: "/chat", label: "Chat", icon: MessageSquare, keywords: "conversation ai assistant ask", shortcut: "G C" },
  { href: "/context", label: "Context Library", icon: Library, keywords: "documents sources knowledge search", shortcut: "G L" },
  { href: "/inbox", label: "Inbox", icon: Inbox, keywords: "action items decisions mentions", shortcut: "G I" },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, keywords: "review queue pending", shortcut: "G A" },
  { href: "/schedules", label: "Schedules", icon: Clock, keywords: "cron recurring tasks automation" },
  { href: "/skills", label: "Skills", icon: Puzzle, keywords: "capabilities agent tools" },
  { href: "/artifacts", label: "Artifacts", icon: FileCode2, keywords: "code documents files generated" },
  { href: "/sandbox", label: "Sandbox", icon: Terminal, keywords: "run code preview execute" },
  { href: "/analytics/costs", label: "AI Costs", icon: Coins, keywords: "spending tokens usage billing" },
  { href: "/integrations", label: "Integrations", icon: Plug, keywords: "connect google drive slack github" },
  { href: "/mcp", label: "MCP Servers", icon: Plug, keywords: "model context protocol tools" },
  { href: "/sharing", label: "Sharing", icon: Share2, keywords: "publish collaborate share" },
  { href: "/priority", label: "Priority & Rules", icon: FileText, keywords: "system prompt documents rules" },
  { href: "/how-it-works", label: "How It Works", icon: BookOpen, keywords: "guide architecture documentation" },
];

const SETTINGS: CommandEntry[] = [
  { href: "/settings", label: "Settings Hub", icon: UserCog, keywords: "preferences configuration", shortcut: "G S" },
  { href: "/settings/api-keys", label: "API Keys", icon: Key, keywords: "tokens access gateway" },
  { href: "/settings/permissions", label: "Permissions", icon: Shield, keywords: "access control tools read write" },
  { href: "/settings/integrations", label: "Chat SDK", icon: Zap, keywords: "discord slack webhook embed" },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, keywords: "credits subscription payments" },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, keywords: "email digest alerts" },
  { href: "/settings/source-trust", label: "Source Trust", icon: Scale, keywords: "weight priority scoring" },
  { href: "/settings/audit", label: "Audit Log", icon: FileSearch, keywords: "activity history events" },
];

const ACTIONS: CommandEntry[] = [
  { href: "/chat", label: "New Conversation", icon: PlusCircle, keywords: "start chat create" },
  { href: "/context", label: "Upload Document", icon: Upload, keywords: "import file meeting pdf" },
  { href: "/integrations", label: "Connect Integration", icon: Plug, keywords: "add service oauth" },
  { href: "/schedules", label: "Create Schedule", icon: Clock, keywords: "automate recurring cron" },
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
      <CommandInput placeholder="Search pages, settings, and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {renderItems(NAVIGATION)}
        </CommandGroup>
        <CommandGroup heading="Settings">
          {renderItems(SETTINGS)}
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          {renderItems(ACTIONS)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
