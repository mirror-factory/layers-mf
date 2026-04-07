'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  expectedResult: string;
  requiresSetup?: string;
}

const CHECKLIST: ChecklistItem[] = [
  // AUTH
  {
    id: 'auth-login',
    category: 'Authentication',
    title: 'Login with Google',
    description: 'Sign in with your Google account',
    expectedResult: 'Redirected to dashboard. User name shows in sidebar.',
  },
  {
    id: 'auth-org',
    category: 'Authentication',
    title: 'Organization auto-created',
    description: 'Check that an org was created on first signup',
    expectedResult: 'Settings > Team shows your organization with you as owner.',
  },

  // CHAT
  {
    id: 'chat-basic',
    category: 'Chat',
    title: 'Send a message to Granger',
    description: 'Go to /chat, type "Hello Granger, who are you?"',
    expectedResult: "Granger responds identifying as Mirror Factory's AI chief of staff. Response references priority docs.",
  },
  {
    id: 'chat-search',
    category: 'Chat',
    title: 'Ask about context',
    description: 'Ask "What meetings have we had recently?" or "What\'s in our context library?"',
    expectedResult: 'Granger calls search_context tool, shows source citations with relevance scores.',
  },
  {
    id: 'chat-model',
    category: 'Chat',
    title: 'Switch models',
    description: 'Change the model selector to different models (Haiku, Sonnet, Opus, GPT, Gemini)',
    expectedResult: 'Each model responds. Response quality varies by tier. No errors.',
  },
  {
    id: 'chat-compaction',
    category: 'Chat',
    title: 'Long conversation compaction',
    description: 'Send 20+ messages in one conversation, then check if compacted_summary is set',
    expectedResult: 'After many messages, conversation stays responsive. Summary stored in DB.',
  },

  // APPROVAL SYSTEM
  {
    id: 'approval-propose',
    category: 'Approvals',
    title: 'Trigger an approval',
    description: 'Ask Granger: "Create a Linear issue for testing the approval system"',
    expectedResult: 'Granger proposes the action. Shows in /approvals with pending status.',
  },
  {
    id: 'approval-approve',
    category: 'Approvals',
    title: 'Approve an action',
    description: 'Go to /approvals, click Approve on a pending item',
    expectedResult: 'Status changes to approved. Reviewed-by and timestamp shown.',
  },
  {
    id: 'approval-reject',
    category: 'Approvals',
    title: 'Reject an action',
    description: 'Go to /approvals, click Reject on a pending item',
    expectedResult: 'Status changes to rejected. Item greyed out.',
  },

  // SETTINGS
  {
    id: 'settings-discord-id',
    category: 'Settings',
    title: 'Link Discord User ID',
    description: 'Go to /settings/api-keys, enter your Discord User ID',
    expectedResult: 'Saved successfully. Toast notification appears.',
    requiresSetup: 'Right-click your Discord profile > Copy User ID',
  },
  {
    id: 'settings-gateway-key',
    category: 'Settings',
    title: 'Set AI Gateway key (optional)',
    description: 'Enter a personal Vercel AI Gateway key',
    expectedResult: 'Key saved. Placeholder shows "key set" after save.',
  },
  {
    id: 'settings-granola',
    category: 'Settings',
    title: 'Connect Granola',
    description: 'Enter your Granola API key (grn_...)',
    expectedResult: 'Badge changes to "Connected". Can now use query_granola tool.',
    requiresSetup: 'Granola Business plan > Settings > API Keys',
  },
  {
    id: 'settings-linear',
    category: 'Settings',
    title: 'Connect Linear',
    description: 'Enter your Linear personal API key',
    expectedResult: 'Badge changes to "Connected". Can now use list_linear_issues tool.',
    requiresSetup: 'Linear > Settings > API > Personal API Keys',
  },
  {
    id: 'settings-notion',
    category: 'Settings',
    title: 'Connect Notion',
    description: 'Enter your Notion integration token (secret_...)',
    expectedResult: 'Badge changes to "Connected". Can now use search_notion tool.',
    requiresSetup: 'notion.so/my-integrations > Create integration > Share pages with it',
  },
  {
    id: 'settings-google',
    category: 'Settings',
    title: 'Connect Google (Gmail + Drive)',
    description: 'Click "Connect Google Account" and complete OAuth flow',
    expectedResult: 'Redirected back. Gmail and Drive show as "Connected".',
    requiresSetup: 'Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars',
  },

  // TOOLS
  {
    id: 'tool-granola',
    category: 'Tools',
    title: 'Query Granola meetings',
    description: 'Ask Granger: "Show me my recent meetings from Granola"',
    expectedResult: 'Granger calls query_granola tool. Shows meeting list with titles and dates.',
    requiresSetup: 'Granola API key must be connected',
  },
  {
    id: 'tool-linear',
    category: 'Tools',
    title: 'List Linear issues',
    description: 'Ask Granger: "What are my in-progress Linear issues?"',
    expectedResult: 'Granger calls list_linear_issues tool. Shows issues with status, assignee, priority.',
    requiresSetup: 'Linear API key must be connected',
  },
  {
    id: 'tool-notion',
    category: 'Tools',
    title: 'Search Notion pages',
    description: 'Ask Granger: "What Notion pages do we have?"',
    expectedResult: 'Granger calls search_notion tool. Shows page titles.',
    requiresSetup: 'Notion token must be connected + pages shared with integration',
  },
  {
    id: 'tool-gmail',
    category: 'Tools',
    title: 'Search Gmail',
    description: 'Ask Granger: "Search my recent emails about invoices"',
    expectedResult: 'Granger calls search_gmail tool. Shows email subjects and senders.',
    requiresSetup: 'Google OAuth must be connected',
  },
  {
    id: 'tool-drive',
    category: 'Tools',
    title: 'List Drive files',
    description: 'Ask Granger: "What files do I have in Google Drive?"',
    expectedResult: 'Granger calls list_drive_files tool. Shows file names and types.',
    requiresSetup: 'Google OAuth must be connected',
  },
  {
    id: 'tool-create-issue',
    category: 'Tools',
    title: 'Create Linear issue (via approval)',
    description: 'Ask Granger: "Create a Linear issue titled Test Issue in the Company team"',
    expectedResult: 'Granger proposes the action (approval queue). Does NOT create directly.',
    requiresSetup: 'Linear API key must be connected',
  },

  // DISCORD
  {
    id: 'discord-slash-ask',
    category: 'Discord',
    title: '/ask command',
    description: 'In Discord, type: /ask question:"What is Granger?"',
    expectedResult: 'Granger responds in the channel with hourglass then full response.',
    requiresSetup: 'Discord bot must be set up + commands registered',
  },
  {
    id: 'discord-slash-status',
    category: 'Discord',
    title: '/status command',
    description: 'In Discord, type: /status',
    expectedResult: 'Shows pending approvals and unread action items.',
    requiresSetup: 'Discord bot must be set up',
  },
  {
    id: 'discord-slash-tasks',
    category: 'Discord',
    title: '/tasks command',
    description: 'In Discord, type: /tasks',
    expectedResult: 'Shows recent Linear issues from context.',
    requiresSetup: 'Discord bot must be set up',
  },
  {
    id: 'discord-dm',
    category: 'Discord',
    title: 'DM Granger',
    description: 'Send a direct message to @Granger in Discord',
    expectedResult: 'Granger responds privately. Message saved with channel=discord.',
    requiresSetup: 'Discord bot must be set up + your Discord ID linked',
  },
  {
    id: 'discord-mention',
    category: 'Discord',
    title: '@mention in channel',
    description: 'In a Discord channel, type: @Granger what happened today?',
    expectedResult: 'Granger responds in a thread. All partners can see it.',
    requiresSetup: 'Discord bot must be set up',
  },

  // CRON JOBS
  {
    id: 'cron-digest',
    category: 'Cron Jobs',
    title: 'Morning digest',
    description: 'Manually trigger: POST /api/cron/digest with Bearer CRON_SECRET',
    expectedResult: 'Personalized digest posted to #granger-digest channel.',
    requiresSetup: 'DISCORD_DIGEST_CHANNEL_ID + CRON_SECRET env vars',
  },
  {
    id: 'cron-alerts',
    category: 'Cron Jobs',
    title: 'Overdue alerts',
    description: 'Manually trigger: POST /api/cron/discord-alerts with Bearer CRON_SECRET',
    expectedResult: 'If overdue items exist, alert posted to #granger-alerts. Otherwise "All clear".',
    requiresSetup: 'DISCORD_ALERTS_CHANNEL_ID + CRON_SECRET env vars',
  },
  {
    id: 'cron-ingest',
    category: 'Cron Jobs',
    title: 'Granola polling',
    description: 'Manually trigger: POST /api/cron/ingest with Bearer CRON_SECRET',
    expectedResult: 'New Granola meetings ingested, extracted, embedded. Count returned.',
    requiresSetup: 'GRANOLA_API_KEY env var',
  },
  {
    id: 'cron-synthesis',
    category: 'Cron Jobs',
    title: 'Nightly synthesis',
    description: 'Manually trigger: POST /api/cron/synthesis with Bearer CRON_SECRET',
    expectedResult: 'Synthesis stored as context_item. Cost estimate returned.',
    requiresSetup: 'Requires context_items in the database',
  },

  // PRIORITY DOCS
  {
    id: 'priority-loaded',
    category: 'Priority Docs',
    title: 'Priority docs in system prompt',
    description: 'Ask Granger: "What are Mirror Factory\'s core values?"',
    expectedResult: 'Granger cites 01-mission.md: quality over speed, transparency, ownership, continuous learning.',
  },
  {
    id: 'priority-conflict',
    category: 'Priority Docs',
    title: 'Values conflict detection',
    description: 'Ask Granger: "Skip testing to ship faster"',
    expectedResult: 'Granger flags conflict with mission doc: "Quality is non-negotiable."',
  },

  // CONTEXT LIBRARY
  {
    id: 'context-upload',
    category: 'Context',
    title: 'Upload a document',
    description: 'Go to /context, upload a PDF or text file',
    expectedResult: 'File processed: title extracted, entities detected, embedding generated.',
  },
  {
    id: 'context-search',
    category: 'Context',
    title: 'Semantic search',
    description: 'Search for a topic in the context library',
    expectedResult: 'Results ranked by RRF score (vector + text combined).',
  },

  // TIPTAP EDITOR
  {
    id: 'editor-view',
    category: 'Editor',
    title: 'Open document in TipTap editor',
    description: 'Click any item in /context to open it',
    expectedResult: 'Rich text editor with toolbar (Bold, Italic, Headings, Lists, Code, Quote). Content is read-only by default.',
  },
  {
    id: 'editor-edit',
    category: 'Editor',
    title: 'Edit and save a document',
    description: 'Click "Edit" → make changes → click "Save"',
    expectedResult: 'Document updates. Toast notification confirms save.',
  },
  {
    id: 'editor-propose',
    category: 'Editor',
    title: 'Propose an edit (majority approval)',
    description: 'Toggle to "Propose" mode → edit → click "Propose Edit"',
    expectedResult: 'Edit proposal created. Message shows "Waiting for approval (2/3 required)". Appears on /approvals.',
  },

  // VERSIONING
  {
    id: 'version-history',
    category: 'Versioning',
    title: 'View document version history',
    description: 'Open a document → scroll to "Version History" section',
    expectedResult: 'List of versions with version number, date, and who edited. Expandable to see content.',
  },
  {
    id: 'version-restore',
    category: 'Versioning',
    title: 'Restore a previous version',
    description: 'Expand a version → click "Restore this version"',
    expectedResult: 'Document content reverts to the old version. A new version snapshot is created.',
  },

  // CODE SANDBOX
  {
    id: 'code-write',
    category: 'Code',
    title: 'Ask Granger to write code',
    description: 'Ask: "Write a bash script to check server health"',
    expectedResult: 'CodeSandbox renders inline with syntax highlighting, filename, copy/download buttons. Saved to Context Library.',
  },
  {
    id: 'code-copy',
    category: 'Code',
    title: 'Copy and download code artifact',
    description: 'Click Copy button on a code artifact, then click Download',
    expectedResult: 'Code copied to clipboard. File downloads with correct filename.',
  },

  // PERMISSIONS
  {
    id: 'perm-view',
    category: 'Permissions',
    title: 'View permission settings',
    description: 'Go to /settings/permissions',
    expectedResult: 'Per-service cards (Linear, Gmail, Notion, Granola, Drive) with Read/Write toggles.',
  },
  {
    id: 'perm-toggle',
    category: 'Permissions',
    title: 'Toggle a permission and verify',
    description: 'Disable "Linear — Read" → go to chat → try /linear',
    expectedResult: 'list_linear_issues tool is not available. Re-enable to restore.',
  },

  // SHARING & EXPORT
  {
    id: 'chat-export-md',
    category: 'Sharing',
    title: 'Export chat as Markdown',
    description: 'In chat with messages, click ⋯ menu → "Export Markdown"',
    expectedResult: 'Downloads a .md file with formatted conversation including tool calls.',
  },
  {
    id: 'chat-export-json',
    category: 'Sharing',
    title: 'Export chat as JSON',
    description: 'Click ⋯ menu → "Export JSON"',
    expectedResult: 'Downloads a .json file with full message parts array.',
  },
  {
    id: 'chat-share',
    category: 'Sharing',
    title: 'Share chat with team member',
    description: 'Click ⋯ menu → "Share..." → select a team member',
    expectedResult: 'Conversation shared. Team member can see it in their chat list.',
    requiresSetup: 'Requires at least 2 users in the org',
  },

  // SCHEDULES
  {
    id: 'schedule-view',
    category: 'Schedules',
    title: 'View scheduled actions',
    description: 'Go to /schedules',
    expectedResult: '5 default schedules visible: Digest, Alerts, Granola, Synthesis, Linear Check. Active/Paused/Completed tabs.',
  },
  {
    id: 'schedule-run-now',
    category: 'Schedules',
    title: 'Run Now on Linear Status Check',
    description: 'Click Run Now on "Linear Status Check"',
    expectedResult: 'Alert shows result summary. Desktop notification appears. New "Linear Status" doc in /context.',
    requiresSetup: 'Requires Linear API key connected',
  },
  {
    id: 'schedule-pause',
    category: 'Schedules',
    title: 'Pause and resume a schedule',
    description: 'Click pause on a schedule → click resume',
    expectedResult: 'Status toggles between Active and Paused.',
  },
  {
    id: 'schedule-chat',
    category: 'Schedules',
    title: 'Create schedule via chat',
    description: 'Ask: "Check my Linear issues every morning at 7am"',
    expectedResult: 'Granger calls schedule_action tool. New schedule appears on /schedules.',
  },

  // NOTIFICATIONS
  {
    id: 'notif-permission',
    category: 'Notifications',
    title: 'Enable desktop notifications',
    description: 'Allow browser notification permission when prompted (or go to Settings → Notifications)',
    expectedResult: 'Browser shows "Allow" prompt. After allowing, notifications will appear.',
  },
  {
    id: 'notif-desktop',
    category: 'Notifications',
    title: 'Receive a desktop notification',
    description: 'Click "Run Now" on a schedule with notifications enabled',
    expectedResult: 'Desktop notification: "Granger: Linear Status Check". Click → navigates to /context.',
  },
  {
    id: 'notif-toast',
    category: 'Notifications',
    title: 'See in-app toast notification',
    description: 'Trigger any notification (schedule run, new approval)',
    expectedResult: 'Sonner toast appears in bottom-right of the app.',
  },

  // SUB-AGENTS
  {
    id: 'agent-linear',
    category: 'Sub-Agents',
    title: 'Linear sub-agent',
    description: 'Ask: "Show my urgent tasks and list all teams"',
    expectedResult: 'Granger delegates to ask_linear_agent. Multiple tool calls (list_issues + list_teams). Results formatted.',
    requiresSetup: 'Requires Linear API key',
  },
  {
    id: 'agent-gmail',
    category: 'Sub-Agents',
    title: 'Gmail sub-agent',
    description: 'Ask: "Search my emails from last week about invoices"',
    expectedResult: 'Granger delegates to ask_gmail_agent. Shows email subjects, senders, dates.',
    requiresSetup: 'Requires Google OAuth',
  },

  // APPROVAL EXECUTION
  {
    id: 'approve-execute',
    category: 'Execution',
    title: 'Approve and execute a Linear issue creation',
    description: 'Ask Granger to create a Linear issue → click "Approve & Execute"',
    expectedResult: 'Issue created in Linear. Clickable URL shown: "Created: PROD-XXX — https://linear.app/..."',
    requiresSetup: 'Requires Linear API key',
  },
  {
    id: 'approve-reject',
    category: 'Execution',
    title: 'Reject a proposed action',
    description: 'Ask Granger to create something → click "Reject"',
    expectedResult: 'Status changes to rejected. Action not executed.',
  },
  {
    id: 'approve-edit-proposal',
    category: 'Execution',
    title: 'Vote on an edit proposal',
    description: 'Check /approvals for edit proposals → click Approve or Reject',
    expectedResult: 'Vote recorded. If 2/3 approve, edit auto-applies to the document.',
  },

  // SCAFFOLDING
  {
    id: 'template-onboarding',
    category: 'Scaffolding',
    title: 'Choose org template in onboarding',
    description: 'New user onboarding → "Choose Template" step → select one → Apply',
    expectedResult: 'Priority docs, default schedules, and permissions created automatically.',
    requiresSetup: 'Requires new user signup flow',
  },

  // LANDING & BRANDING
  {
    id: 'brand-landing',
    category: 'Branding',
    title: 'Landing page says Granger',
    description: 'Visit http://localhost:3000 while logged out',
    expectedResult: '"Your AI Chief of Staff" headline. "Meet Granger" CTA. No "Layers" text.',
  },
  {
    id: 'brand-dark-mode',
    category: 'Branding',
    title: 'Dark mode renders correctly',
    description: 'Toggle dark mode → check chat, approvals, context library, inbox',
    expectedResult: 'All components have proper dark backgrounds. No white flashes or unreadable text.',
  },
];

const STORAGE_KEY = 'granger-testing-checklist';

export function TestingChecklist() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(CHECKLIST.map(i => i.category)))],
    []
  );

  const filtered = activeCategory === 'all'
    ? CHECKLIST
    : CHECKLIST.filter(i => i.category === activeCategory);

  const totalChecked = Object.values(checked).filter(Boolean).length;
  const totalItems = CHECKLIST.length;
  const progressPercent = totalItems > 0 ? (totalChecked / totalItems) * 100 : 0;

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const categoryCount = (cat: string) =>
    cat === 'all'
      ? totalItems
      : CHECKLIST.filter(i => i.category === cat).length;

  const categoryCheckedCount = (cat: string) => {
    const items = cat === 'all' ? CHECKLIST : CHECKLIST.filter(i => i.category === cat);
    return items.filter(i => checked[i.id]).length;
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 left-4 z-50 gap-2 shadow-lg hidden md:inline-flex"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        Testing ({totalChecked}/{totalItems})
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold">Granger Testing Checklist</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalChecked}/{totalItems} tests completed
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setChecked({})}>
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-6 py-2 flex gap-1 flex-wrap border-b">
          {categories.map(cat => {
            const count = categoryCount(cat);
            const done = categoryCheckedCount(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
                {' '}
                <span className="opacity-70">
                  {done}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Checklist items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filtered.map(item => {
            const isChecked = !!checked[item.id];
            return (
              <div
                key={item.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggle(item.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(item.id);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {isChecked && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium text-sm ${
                          isChecked ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Expected: {item.expectedResult}
                    </p>
                    {item.requiresSetup && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Setup: {item.requiresSetup}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
