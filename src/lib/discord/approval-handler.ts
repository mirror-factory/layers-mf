import { createAdminClient } from '@/lib/supabase/server';
import { sendMessage, addReaction } from './api';

/**
 * Post an approval proposal to Discord with reaction buttons.
 * Returns the Discord message ID for tracking.
 */
export async function postApprovalToDiscord(
  channelId: string,
  approvalId: string,
  actionType: string,
  targetService: string,
  reasoning: string,
  conflictReason?: string | null
): Promise<string | null> {
  let msg = `**🔔 Approval Required**\n\n`;
  msg += `**Action:** ${formatActionType(actionType)}\n`;
  msg += `**Service:** ${targetService}\n`;
  msg += `**Reason:** ${reasoning}\n`;

  if (conflictReason) {
    msg += `\n⚠️ **Priority Doc Conflict:** ${conflictReason}\n`;
  }

  msg += `\nReact ✅ to approve or ❌ to reject.`;
  msg += `\n\`approval:${approvalId}\``; // Hidden ID for tracking

  const result = await sendMessage(channelId, msg);

  if (result?.id) {
    await addReaction(channelId, result.id, '✅');
    await addReaction(channelId, result.id, '❌');
    return result.id;
  }

  return null;
}

/**
 * Handle a reaction on an approval message.
 * Called from the interactions endpoint when a MESSAGE_REACTION_ADD event fires.
 */
export async function handleApprovalReaction(
  messageContent: string,
  emoji: string,
  discordUserId: string
): Promise<{ success: boolean; action: string; message: string }> {
  // Extract approval ID from message content
  const match = messageContent.match(/`approval:([a-f0-9-]+)`/);
  if (!match) {
    return { success: false, action: 'none', message: 'Not an approval message' };
  }

  const approvalId = match[1];
  const action = emoji === '✅' ? 'approve' : emoji === '❌' ? 'reject' : null;

  if (!action) {
    return { success: false, action: 'none', message: 'Unknown reaction' };
  }

  const supabase = createAdminClient();

  // Look up Supabase user from Discord user ID
  const { data: settings } = await supabase
    .from('partner_settings')
    .select('user_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!settings) {
    return { success: false, action, message: 'Discord user not linked' };
  }

  // Update approval queue
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { data, error } = await supabase
    .from('approval_queue')
    .update({
      status: newStatus,
      reviewed_by: settings.user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    return { success: false, action, message: 'Approval not found or already reviewed' };
  }

  return {
    success: true,
    action,
    message: `Action ${newStatus}: ${data.action_type} → ${data.target_service}`,
  };
}

function formatActionType(type: string): string {
  const labels: Record<string, string> = {
    create_task: '📋 Create Task',
    send_message: '💬 Send Message',
    draft_email: '✉️ Draft Email',
    update_task: '✏️ Update Task',
    send_slack: '💬 Send Slack Message',
    update_issue: '✏️ Update Issue',
  };
  return labels[type] ?? type;
}
