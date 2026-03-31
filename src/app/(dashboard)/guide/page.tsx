import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Library,
  MessageSquare,
  FolderKanban,
  Inbox,
  Plug,
  Search,
  Bot,
  Settings,
  Shield,
  Rocket,
  UserPlus,
  Upload,
  HelpCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "User Guide",
  description: "Learn how to get the most out of Granger.",
};

/* ------------------------------------------------------------------ */
/*  Getting Started Steps                                              */
/* ------------------------------------------------------------------ */

const GETTING_STARTED = [
  {
    step: 1,
    icon: UserPlus,
    title: "Sign up and create your organization",
    description:
      "Head to the signup page and create your account with email or sign in with Google. Once logged in, you will be guided through onboarding where you name your organization and invite team members. Your organization is your shared workspace \u2014 everything you add to Granger is scoped to it.",
  },
  {
    step: 2,
    icon: Plug,
    title: "Connect your first integration",
    description:
      "Visit the Integrations page and choose a tool your team already uses \u2014 Google Drive, Linear, Slack, GitHub, Discord, or Granola. Click Connect, authorize access, and select which channels, repos, or folders to sync. Granger will start pulling in your content automatically. You can watch the sync progress in real time.",
  },
  {
    step: 3,
    icon: Upload,
    title: "Upload your first document",
    description:
      "Go to the Context Library and click Upload. You can drag and drop PDFs, Word documents, text files, Markdown, spreadsheets, or CSV files. Granger will automatically extract the text, break it into searchable chunks, generate embeddings for AI-powered search, and surface key entities like people, topics, and decisions.",
  },
  {
    step: 4,
    icon: MessageSquare,
    title: "Ask your first question in Chat",
    description:
      "Open Chat and type a question about your content \u2014 for example, \"What were the key decisions from last week's meeting?\" Granger searches across all your connected sources, finds the most relevant information, and gives you an answer with clickable citations so you can verify the source.",
  },
];

/* ------------------------------------------------------------------ */
/*  Feature Guide Sections                                             */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    id: "context-library",
    icon: Library,
    title: "Context Library",
    content: `The Context Library is your central hub for all content in Granger. Browse everything that has been uploaded or synced from your connected tools. Use the search bar to find items by title, content, or entity (people, topics, decisions). Filter by source type, date range, or processing status to narrow down results.

Granger supports a wide range of file types including PDF, DOCX, XLSX, TXT, Markdown, and CSV. When you upload or sync a file, it goes through an automated processing pipeline: text extraction, intelligent chunking, embedding generation, entity extraction, and inbox item creation. You can track the processing status of each item in real time.

You can export any item as Markdown or JSON, view its version history, and see a content health score that tells you how fresh and complete the item is. Items from integrations are automatically re-synced when the source changes, so your library stays up to date without manual effort.`,
  },
  {
    id: "chat",
    icon: MessageSquare,
    title: "Chat",
    content: `Chat lets you ask questions about your content using natural language. Type a question and Granger will search across all your sources using hybrid search (combining keyword matching and AI-powered semantic search) to find the most relevant information. Every answer includes clickable citations so you can jump to the original source.

You can switch between different AI models depending on your needs \u2014 faster models for quick lookups or more capable models for complex analysis. Each chat conversation maintains its own context, so you can have multiple ongoing threads. Within a Session, chat is automatically scoped to just the content linked to that workspace.

Use the feedback buttons (thumbs up/down) on any response to help Granger learn what is useful to you. This feedback feeds into your Ditto profile and improves future results. You can also view the tool calls the AI made behind the scenes to understand how it found its answer.`,
  },
  {
    id: "sessions",
    icon: FolderKanban,
    title: "Sessions",
    content: `Sessions are focused workspaces where you group related content together. Create a session for a project, a meeting series, or any topic you are actively working on. Link context items to a session manually, or let Granger auto-link new items when it detects they are related.

When you open a session, you get a scoped view of just the content that matters for that workspace. Chat within a session only searches the linked items, giving you more precise answers. The session sidebar shows AI-generated insights like cross-source connections and contradictions between items.

Sessions help you stay organized without creating rigid folder structures. You can have as many sessions as you need, and the same content item can appear in multiple sessions. Think of them as smart lenses over your knowledge base.`,
  },
  {
    id: "inbox",
    icon: Inbox,
    title: "Inbox",
    content: `The Inbox is where Granger surfaces items that need your attention. When new content is processed, Granger uses AI to determine if it contains action items, important decisions, or information you should review. Each inbox item is assigned a priority level (high, medium, low) based on its content and relevance.

Your triage workflow is simple: review each item, then archive it, link it to a session, or take action on it. Items are deduplicated automatically so you do not see the same thing twice even if it appears across multiple sources. The inbox respects your Ditto preferences, so items related to your interests are ranked higher.

You can also configure notification preferences to get a daily digest email summarizing your inbox at a time that works for you. The digest includes the most important items from the past 24 hours.`,
  },
  {
    id: "integrations",
    icon: Plug,
    title: "Integrations",
    content: `Granger connects to the tools your team already uses. Currently supported integrations include Google Drive (documents, spreadsheets, PDFs), Linear (issues and projects), Slack (channel messages), GitHub (issues and discussions), Discord (server messages), and Granola (meeting notes).

To connect a tool, visit the Integrations page and click Connect next to the provider. You will be asked to authorize access, then you can choose exactly which channels, repositories, or folders to sync using selective sync. This means you only bring in the content that matters \u2014 not everything.

Each integration shows its sync progress, last sync time, and health status. Granger uses webhooks to receive real-time updates from your tools, so new content appears within minutes of being created. The integration catalog page documents the content types, capabilities, and limits for each provider.`,
  },
  {
    id: "search",
    icon: Search,
    title: "Search",
    content: `Granger uses hybrid search to find content across all your sources. This combines traditional keyword matching with AI-powered semantic search, so you can find things even when you do not remember the exact words. Results are ranked using a combination of relevance, freshness, and source trust weighting.

You can save frequently used searches and share them with your team. Saved searches appear as chips in the search bar for quick access. When results mention people, topics, or decisions, these appear as interactive entity chips \u2014 click on any entity to instantly search for everything related to it.

Search results include a snippet showing where your query matched, the source integration, and a relevance score. From the results, you can open the full item, link it to a session, or start a chat conversation about it.`,
  },
  {
    id: "ditto",
    icon: Bot,
    title: "Ditto",
    content: `Ditto is your personal AI profile within Granger. It learns your preferences over time by observing what you search for, click on, and find useful. This profile helps Granger personalize your experience \u2014 from inbox ranking to search results to chat style.

Visit the Ditto page to see what Granger has learned about your interests, working patterns, and communication preferences. You can manually edit any of these preferences if something does not look right. Ditto also powers the "For You" suggestions on your dashboard, proactively surfacing content you might find relevant.

Your Ditto profile is private to you \u2014 other team members cannot see your preferences. The profile is regenerated weekly to stay current with your evolving interests.`,
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    content: `Settings let you customize how Granger works for you and your team. Source trust weighting lets you adjust how much weight different sources get in search results \u2014 slide a source up to prioritize it or down to de-emphasize it. This affects both search ranking and chat answers.

Notification preferences control what you receive and when. Toggle individual notification types (digest, mentions, action items) and set your preferred delivery time for the daily digest. Team management lets org admins invite and remove members, assign roles, and view the audit log of all actions taken.

Billing shows your current plan, credit balance, and usage history. You can purchase additional credits, view a breakdown by model and operation, and track your spending over time.`,
  },
  {
    id: "admin",
    icon: Shield,
    title: "Admin",
    content: `The Admin panel is available to super-admins and provides platform-level configuration. Here you can manage model pricing (setting costs for 30+ AI models), configure credit rates and profit margins, and edit the credit packages available for purchase.

The platform stats dashboard shows total organizations, users, content items, credits consumed, and a cost-versus-revenue breakdown. All pricing changes take effect immediately and are cached for performance \u2014 no code deploys needed to adjust pricing.

This section is only visible if your account has super-admin privileges. Regular users and team admins do not have access to platform configuration.`,
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">User Guide</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Everything you need to know to get the most out of Granger.
        </p>
      </div>

      {/* Getting Started */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Getting Started</h2>
        </div>
        <div className="grid gap-4">
          {GETTING_STARTED.map(({ step, icon: Icon, title, description }) => (
            <Card key={step}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {step}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm">{title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Guide */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Features Guide</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <Accordion type="multiple" className="px-5">
              {FEATURES.map(({ id, icon: Icon, title, content }) => (
                <AccordionItem key={id} value={id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span>{title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-muted-foreground leading-relaxed pl-7">
                      {content.split("\n\n").map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Help footer */}
      <div className="rounded-lg border bg-muted/50 p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Need more help? Use the Chat feature to ask Granger about its own
          capabilities, or reach out to your team admin.
        </p>
      </div>
    </div>
  );
}
