import { generateText } from 'ai';
import { gateway, TASK_MODELS } from '@/lib/ai/config';
import { loadPriorityDocs } from '@/lib/ai/priority-docs';
import { createTools } from '@/lib/ai/tools';
import { createAdminClient } from '@/lib/supabase/server';
import { sendFollowup } from './api';

const DM_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff, in a private DM.
This is a personal conversation — be more conversational than in channels.
Keep responses under 2000 characters (Discord limit).
Use markdown formatting.`;

export async function handleDMMessage(
  message: string,
  discordUserId: string,
  interactionToken: string,
  applicationId: string
) {
  const supabase = createAdminClient();

  // Look up user
  const { data: settings } = await supabase
    .from('partner_settings')
    .select('user_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!settings) {
    await sendFollowup(
      interactionToken,
      'Your Discord account is not linked. Visit Settings to link it.',
      applicationId
    );
    return;
  }

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', settings.user_id)
    .single();

  if (!member) {
    await sendFollowup(interactionToken, 'No organization found.', applicationId);
    return;
  }

  const priorityDocs = await loadPriorityDocs();
  const tools = createTools(supabase, member.org_id);

  const { text } = await generateText({
    model: gateway(TASK_MODELS.extraction),
    system: `${priorityDocs}\n\n${DM_INSTRUCTIONS}`,
    messages: [{ role: 'user', content: message }],
    tools,
    maxSteps: 6,
  });

  // Save conversation
  await supabase.from('chat_messages').insert([
    {
      org_id: member.org_id,
      user_id: settings.user_id,
      channel: 'discord',
      role: 'user',
      content: [{ type: 'text', text: message }],
    },
    {
      org_id: member.org_id,
      user_id: settings.user_id,
      channel: 'discord',
      role: 'assistant',
      content: [{ type: 'text', text: text ?? '' }],
      model: TASK_MODELS.extraction,
    },
  ]);

  // Send response (split if needed for Discord's 2000 char limit)
  const response = text ?? 'I processed your request but had no text response.';
  const chunks = splitMessage(response, 2000);
  for (const chunk of chunks) {
    await sendFollowup(interactionToken, chunk, applicationId);
  }
}

function splitMessage(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline for cleaner breaks
    let splitAt = remaining.lastIndexOf('\n', max);
    if (splitAt < max / 2) splitAt = max;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}
