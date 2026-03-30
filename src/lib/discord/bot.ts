/**
 * Central Granger bot instance using Vercel Chat SDK.
 *
 * Replaces the custom Discord interaction/webhook handlers with a unified
 * Chat SDK bot that handles mentions, DMs, slash commands, and approval
 * reactions through a single configuration.
 *
 * The Chat SDK's DiscordAdapter handles:
 * - Ed25519 signature verification (replaces verify.ts)
 * - Message splitting for Discord's 2000 char limit
 * - Post + edit streaming pattern
 * - Thread management
 * - Reaction handling
 *
 * Existing modules preserved:
 * - tools.ts — AI tool definitions (search_context, get_document)
 * - priority-docs.ts — priority document loader
 * - config.ts — model configuration
 * - approval-handler.ts — approval posting logic (used by approval tools)
 */

import { Chat, toAiMessages } from 'chat';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { createPostgresState } from '@chat-adapter/state-pg';
import { generateText, stepCountIs } from 'ai';
import { gateway, TASK_MODELS } from '@/lib/ai/config';
import { loadPriorityDocs } from '@/lib/ai/priority-docs';
import { createTools } from '@/lib/ai/tools';
import { createAdminClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const GRANGER_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff. You serve three partners: Alfonso, Kyle, and Bobby.
You are proactive, thorough, and values-aware. Lead with the answer, then explain.
Keep Discord responses under 2000 characters. Use markdown that works in Discord.
When citing sources, use bold for titles and include dates.
All write actions must go through the approval queue — never execute directly.

Guidelines:
- Always call search_context before answering any question — do not rely on your training data alone
- Use multiple search queries with different angles if one query isn't sufficient
- Call get_document for documents that appear highly relevant to get their full content
- Be concise and specific in your final answer
- Cite sources by name and date using **Source: title (date)** format`;

const DM_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff, in a private DM.
This is a personal conversation — be more conversational than in channels.
Keep responses under 2000 characters (Discord limit).
Use markdown formatting.

Guidelines:
- Always call search_context before answering any question
- Use multiple search queries with different angles if one query isn't sufficient
- Call get_document for documents that appear highly relevant
- Be concise and specific`;

// ---------------------------------------------------------------------------
// Helper: resolve Discord user → Supabase user + org
// ---------------------------------------------------------------------------

interface ResolvedUser {
  userId: string;
  orgId: string;
}

async function resolveDiscordUser(
  discordUserId: string
): Promise<ResolvedUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: settings } = await supabase
    .from('partner_settings')
    .select('user_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!settings) return null;

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', (settings as { user_id: string }).user_id)
    .single();

  if (!member) return null;

  return {
    userId: (settings as { user_id: string }).user_id,
    orgId: (member as { org_id: string }).org_id,
  };
}

// ---------------------------------------------------------------------------
// Helper: save chat messages to DB
// ---------------------------------------------------------------------------

async function saveChatMessages(
  orgId: string,
  userId: string,
  userText: string,
  assistantText: string,
  model: string,
  discordChannelId?: string
) {
  const supabase = createAdminClient();

  await supabase.from('chat_messages').insert([
    {
      org_id: orgId,
      user_id: userId,
      session_id: null,
      conversation_id: null,
      channel: 'discord',
      discord_channel_id: discordChannelId ?? null,
      role: 'user',
      content: [{ type: 'text', text: userText }] as unknown as Json,
      model: null,
    },
    {
      org_id: orgId,
      user_id: userId,
      session_id: null,
      conversation_id: null,
      channel: 'discord',
      discord_channel_id: discordChannelId ?? null,
      role: 'assistant',
      content: [{ type: 'text', text: assistantText }] as unknown as Json,
      model,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Helper: run the Granger agent loop
// ---------------------------------------------------------------------------

async function runGrangerAgent(
  userMessage: string,
  orgId: string,
  systemPromptOverride?: string
): Promise<string> {
  const supabase = createAdminClient();
  const priorityDocs = await loadPriorityDocs();
  const tools = createTools(supabase, orgId);
  const systemPrompt = systemPromptOverride ?? GRANGER_INSTRUCTIONS;

  const { text } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: `${priorityDocs}\n\n${systemPrompt}`,
    messages: [{ role: 'user' as const, content: userMessage }],
    tools,
    stopWhen: stepCountIs(6),
  });

  return text || 'I processed your request but had no text response.';
}

// ---------------------------------------------------------------------------
// Helper: run Granger agent with thread history (for multi-turn conversations)
// ---------------------------------------------------------------------------

async function runGrangerAgentWithHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  threadMessages: any[],
  orgId: string,
  systemPromptOverride?: string
): Promise<string> {
  const supabase = createAdminClient();
  const priorityDocs = await loadPriorityDocs();
  const tools = createTools(supabase, orgId);
  const systemPrompt = systemPromptOverride ?? GRANGER_INSTRUCTIONS;

  const { text } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: `${priorityDocs}\n\n${systemPrompt}`,
    messages: threadMessages,
    tools,
    stopWhen: stepCountIs(6),
  });

  return text || 'I processed your request but had no text response.';
}

// ---------------------------------------------------------------------------
// Build the Postgres connection string from env vars
// ---------------------------------------------------------------------------

function getPostgresUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const hostname = new URL(supabaseUrl).hostname;
    return `postgresql://postgres:${serviceKey}@${hostname}:5432/postgres`;
  }

  throw new Error(
    'DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for Chat SDK state adapter'
  );
}

// ---------------------------------------------------------------------------
// Create the Chat SDK bot instance
// ---------------------------------------------------------------------------

export function createGrangerBot() {
  const discord = createDiscordAdapter({
    botToken: process.env.DISCORD_BOT_TOKEN,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    applicationId: process.env.DISCORD_APPLICATION_ID,
  });

  const state = createPostgresState({
    url: getPostgresUrl(),
    keyPrefix: 'granger',
  });

  const chat = new Chat({
    userName: 'Granger',
    adapters: { discord },
    state,
    concurrency: 'queue', // Queue messages on same thread rather than dropping
    fallbackStreamingPlaceholderText: null, // Don't post "..." placeholder
  });

  // ----------- Handle @mentions in channels (unsubscribed threads) -----------
  chat.onNewMention(async (thread, message) => {
    const resolved = await resolveDiscordUser(message.author.userId);
    if (!resolved) {
      await thread.post(
        'Your Discord account is not linked. Visit **Settings > API Keys** to link your account.'
      );
      return;
    }

    // Subscribe so follow-up messages in this thread also reach us
    await thread.subscribe();

    // Build AI messages from thread history for context
    const historyMessages = [];
    for await (const msg of thread.messages) {
      historyMessages.push(msg);
    }
    // thread.messages is newest-first; AI SDK expects chronological
    historyMessages.reverse();

    const aiMessages = await toAiMessages(historyMessages);

    const responseText = await runGrangerAgentWithHistory(
      aiMessages,
      resolved.orgId
    );

    await thread.post(responseText);

    // Save to chat_messages (fire-and-forget)
    void saveChatMessages(
      resolved.orgId,
      resolved.userId,
      message.text,
      responseText,
      TASK_MODELS.chat
    );
  });

  // ----------- Handle messages in subscribed threads (follow-ups) -----------
  chat.onSubscribedMessage(async (thread, message) => {
    // Skip bot messages
    if (message.author.userId === discord.botUserId) return;

    const resolved = await resolveDiscordUser(message.author.userId);
    if (!resolved) return;

    // Rebuild full thread history for multi-turn context
    const historyMessages = [];
    for await (const msg of thread.messages) {
      historyMessages.push(msg);
    }
    historyMessages.reverse();

    const aiMessages = await toAiMessages(historyMessages);

    const responseText = await runGrangerAgentWithHistory(
      aiMessages,
      resolved.orgId
    );

    await thread.post(responseText);

    void saveChatMessages(
      resolved.orgId,
      resolved.userId,
      message.text,
      responseText,
      TASK_MODELS.chat
    );
  });

  // ----------- Handle DMs -----------
  chat.onDirectMessage(async (thread, message) => {
    const resolved = await resolveDiscordUser(message.author.userId);
    if (!resolved) {
      await thread.post(
        'Your Discord account is not linked. Visit Settings to link it.'
      );
      return;
    }

    await thread.subscribe();

    const responseText = await runGrangerAgent(
      message.text,
      resolved.orgId,
      DM_INSTRUCTIONS
    );

    await thread.post(responseText);

    void saveChatMessages(
      resolved.orgId,
      resolved.userId,
      message.text,
      responseText,
      TASK_MODELS.chat
    );
  });

  // ----------- Handle slash commands -----------
  chat.onSlashCommand('/ask', async (event) => {
    const resolved = await resolveDiscordUser(event.user.userId);
    if (!resolved) {
      await event.channel.post(
        'Your Discord account is not linked. Visit **Settings > API Keys** to link your account.'
      );
      return;
    }

    const question = event.text;
    if (!question) {
      await event.channel.post('Please provide a question.');
      return;
    }

    const responseText = await runGrangerAgent(question, resolved.orgId);
    await event.channel.post(responseText);

    void saveChatMessages(
      resolved.orgId,
      resolved.userId,
      question,
      responseText,
      TASK_MODELS.chat
    );
  });

  chat.onSlashCommand('/status', async (event) => {
    const resolved = await resolveDiscordUser(event.user.userId);
    if (!resolved) {
      await event.channel.post('Your Discord account is not linked.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const [approvals, overdue] = await Promise.all([
      supabase
        .from('approval_queue')
        .select('id, action_type, target_service, created_at')
        .eq('org_id', resolved.orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('inbox_items')
        .select('id, title, priority, created_at')
        .eq('org_id', resolved.orgId)
        .eq('status', 'unread')
        .eq('type', 'action_item')
        .order('created_at', { ascending: true })
        .limit(5),
    ]);

    let msg = '**Granger Status**\n\n';
    msg += `**Pending Approvals:** ${approvals.data?.length ?? 0}\n`;
    for (const a of (approvals.data ?? []) as Array<{ action_type: string; target_service: string }>) {
      msg += `\u2022 ${a.action_type} \u2192 ${a.target_service}\n`;
    }
    msg += `\n**Unread Action Items:** ${overdue.data?.length ?? 0}\n`;
    for (const item of overdue.data ?? []) {
      msg += `\u2022 [${item.priority}] ${item.title}\n`;
    }

    await event.channel.post(msg);
  });

  chat.onSlashCommand('/tasks', async (event) => {
    const resolved = await resolveDiscordUser(event.user.userId);
    if (!resolved) {
      await event.channel.post('Your Discord account is not linked.');
      return;
    }

    const supabase = createAdminClient();
    const { data: items } = await supabase
      .from('context_items')
      .select('title, source_type, entities')
      .eq('org_id', resolved.orgId)
      .eq('source_type', 'linear')
      .eq('status', 'ready')
      .order('ingested_at', { ascending: false })
      .limit(10);

    let msg = '**Recent Linear Issues**\n\n';
    for (const item of items ?? []) {
      msg += `\u2022 ${item.title}\n`;
    }
    if (!items?.length) msg += '_No Linear issues found in context._';

    await event.channel.post(msg);
  });

  chat.onSlashCommand('/digest', async (event) => {
    const resolved = await resolveDiscordUser(event.user.userId);
    if (!resolved) {
      await event.channel.post('Your Discord account is not linked.');
      return;
    }

    await event.channel.post(
      'Generating your digest... This may take a moment.'
    );

    const supabase = createAdminClient();
    const { generateInboxForUser } = await import('@/lib/inbox/generate');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = await generateInboxForUser(
      supabase,
      resolved.orgId,
      resolved.userId,
      since
    );

    await event.channel.post(
      `Digest generated: **${count}** new inbox items. Check /inbox on the web for details.`
    );
  });

  // ----------- Handle approval reactions -----------
  chat.onReaction(async (event) => {
    // Only handle added reactions, not removals
    if (!event.added) return;

    const emojiName =
      typeof event.emoji === 'string' ? event.emoji : event.emoji.name;

    // Only process checkmark and X reactions
    if (emojiName !== '\u2705' && emojiName !== '\u274C' &&
        emojiName !== 'white_check_mark' && emojiName !== 'x') {
      return;
    }

    // Check if this message contains an approval ID
    const messageText = event.message?.text ?? '';
    const match = messageText.match(/`approval:([a-f0-9-]+)`/);
    if (!match) return;

    const approvalId = match[1];
    const isApprove = emojiName === '\u2705' || emojiName === 'white_check_mark';
    const action = isApprove ? 'approved' : 'rejected';

    const resolved = await resolveDiscordUser(event.user.userId);
    if (!resolved) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const { data } = await supabase
      .from('approval_queue')
      .update({
        status: action,
        reviewed_by: resolved.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('status', 'pending')
      .select()
      .single();

    const approval = data as { action_type: string; target_service: string } | null;
    if (approval && event.thread) {
      await event.thread.post(
        `Action ${action}: ${approval.action_type} \u2192 ${approval.target_service}`
      );
    }
  });

  return chat;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let botInstance: ReturnType<typeof createGrangerBot> | null = null;

export function getBot() {
  if (!botInstance) {
    botInstance = createGrangerBot();
  }
  return botInstance;
}

// Re-export the Chat type for route handlers
export type GrangerBot = ReturnType<typeof createGrangerBot>;
