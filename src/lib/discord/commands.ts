import { generateText, stepCountIs } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { loadPriorityDocs } from '@/lib/ai/priority-docs';
import { createTools } from '@/lib/ai/tools';
import { createAdminClient } from '@/lib/supabase/server';
import { sendFollowup } from './api';
import type { DiscordInteraction } from './types';
import type { Json } from '@/lib/database.types';

const GRANGER_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff, responding via Discord.
Keep responses concise (under 2000 characters for Discord's limit).
Use markdown formatting that works in Discord.
When citing sources, use bold text for titles.

Guidelines:
- Always call search_context before answering any question — do not rely on your training data alone
- Use multiple search queries with different angles if one query isn't sufficient
- Call get_document for documents that appear highly relevant to get their full content
- Be concise and specific in your final answer
- Cite sources by name and date using **Source: title (date)** format`;

export async function handleSlashCommand(
  interaction: DiscordInteraction,
  applicationId: string
) {
  const commandName = interaction.data?.name;
  const discordUserId =
    interaction.member?.user?.id ?? interaction.user?.id;

  if (!discordUserId) {
    await sendFollowup(
      interaction.token,
      'Could not identify user.',
      applicationId
    );
    return;
  }

  // Look up Supabase user from Discord user ID
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from('partner_settings')
    .select('user_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!settings) {
    await sendFollowup(
      interaction.token,
      'Your Discord account is not linked. Visit **Settings > API Keys** to link your account.',
      applicationId
    );
    return;
  }

  const userId: string = settings.user_id;

  // Get org_id
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single();

  if (!member) {
    await sendFollowup(
      interaction.token,
      'No organization found for your account.',
      applicationId
    );
    return;
  }

  const orgId = member.org_id;

  try {
    switch (commandName) {
      case 'ask': {
        const question = interaction.data?.options?.find(
          (o) => o.name === 'question'
        )?.value;
        if (!question) {
          await sendFollowup(
            interaction.token,
            'Please provide a question.',
            applicationId
          );
          return;
        }
        await handleAskCommand(
          question,
          orgId,
          userId,
          supabase,
          interaction,
          applicationId
        );
        break;
      }
      case 'status': {
        await handleStatusCommand(orgId, supabase, interaction, applicationId);
        break;
      }
      case 'tasks': {
        await handleTasksCommand(orgId, supabase, interaction, applicationId);
        break;
      }
      case 'digest': {
        await handleDigestCommand(
          orgId,
          userId,
          supabase,
          interaction,
          applicationId
        );
        break;
      }
      default:
        await sendFollowup(
          interaction.token,
          `Unknown command: ${commandName}`,
          applicationId
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An error occurred';
    await sendFollowup(interaction.token, `Error: ${msg}`, applicationId);
  }
}

async function handleAskCommand(
  question: string,
  orgId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  interaction: DiscordInteraction,
  applicationId: string
) {
  const priorityDocs = await loadPriorityDocs();
  const tools = createTools(supabase, orgId);

  // Use generateText with tools for non-streaming multi-step agent loop
  const { text: responseText } = await generateText({
    model: gateway('anthropic/claude-sonnet-4.6'),
    system: `${priorityDocs}\n\n${GRANGER_INSTRUCTIONS}`,
    messages: [{ role: 'user' as const, content: question }],
    tools,
    stopWhen: stepCountIs(6),
  });

  // Save conversation to chat_messages
  void (supabase as ReturnType<typeof createAdminClient>)
    .from('chat_messages')
    .insert({
      org_id: orgId,
      user_id: userId,
      session_id: null,
      conversation_id: null,
      channel: 'discord',
      discord_channel_id: interaction.channel_id,
      role: 'user',
      content: [{ type: 'text', text: question }] as unknown as Json,
      model: null,
    })
    .then();

  void (supabase as ReturnType<typeof createAdminClient>)
    .from('chat_messages')
    .insert({
      org_id: orgId,
      user_id: userId,
      session_id: null,
      conversation_id: null,
      channel: 'discord',
      discord_channel_id: interaction.channel_id,
      role: 'assistant',
      content: [{ type: 'text', text: responseText }] as unknown as Json,
      model: 'anthropic/claude-sonnet-4.6',
    })
    .then();

  const finalText =
    responseText || 'I processed your request but had no text response.';

  // Discord has 2000 char limit — split if needed
  const chunks = splitMessage(finalText, 2000);
  for (const chunk of chunks) {
    await sendFollowup(interaction.token, chunk, applicationId);
  }
}

async function handleStatusCommand(
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  interaction: DiscordInteraction,
  applicationId: string
) {
  const [approvals, overdue] = await Promise.all([
    supabase
      .from('approval_queue')
      .select('id, action_type, target_service, created_at')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('inbox_items')
      .select('id, title, priority, created_at')
      .eq('org_id', orgId)
      .eq('status', 'unread')
      .eq('type', 'action_item')
      .order('created_at', { ascending: true })
      .limit(5),
  ]);

  let msg = '**Granger Status**\n\n';
  msg += `**Pending Approvals:** ${approvals.data?.length ?? 0}\n`;
  for (const a of approvals.data ?? []) {
    msg += `• ${a.action_type} → ${a.target_service}\n`;
  }
  msg += `\n**Unread Action Items:** ${overdue.data?.length ?? 0}\n`;
  for (const item of overdue.data ?? []) {
    msg += `• [${item.priority}] ${item.title}\n`;
  }

  await sendFollowup(interaction.token, msg, applicationId);
}

async function handleTasksCommand(
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  interaction: DiscordInteraction,
  applicationId: string
) {
  const { data: items } = await supabase
    .from('context_items')
    .select('title, source_type, entities')
    .eq('org_id', orgId)
    .eq('source_type', 'linear')
    .eq('status', 'ready')
    .order('ingested_at', { ascending: false })
    .limit(10);

  let msg = '**Recent Linear Issues**\n\n';
  for (const item of items ?? []) {
    msg += `• ${item.title}\n`;
  }
  if (!items?.length) msg += '_No Linear issues found in context._';

  await sendFollowup(interaction.token, msg, applicationId);
}

async function handleDigestCommand(
  orgId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  interaction: DiscordInteraction,
  applicationId: string
) {
  await sendFollowup(
    interaction.token,
    'Generating your digest... This may take a moment.',
    applicationId
  );

  const { generateInboxForUser } = await import('@/lib/inbox/generate');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await generateInboxForUser(supabase, orgId, userId, since);

  await sendFollowup(
    interaction.token,
    `Digest generated: **${count}** new inbox items. Check /inbox on the web for details.`,
    applicationId
  );
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline for cleaner breaks
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength / 2) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}
