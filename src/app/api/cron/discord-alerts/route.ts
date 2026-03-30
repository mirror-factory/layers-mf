import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/discord/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const alertsChannelId = process.env.DISCORD_ALERTS_CHANNEL_ID;

  if (!alertsChannelId) {
    return NextResponse.json({ error: 'DISCORD_ALERTS_CHANNEL_ID not set' }, { status: 500 });
  }

  const alerts: string[] = [];

  // 1. Check for overdue action items (unread > 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: overdueItems } = await supabase
    .from('inbox_items')
    .select('title, priority, created_at, type')
    .eq('status', 'unread')
    .eq('type', 'action_item')
    .lt('created_at', threeDaysAgo)
    .order('created_at', { ascending: true })
    .limit(10);

  if (overdueItems?.length) {
    let msg = `**\u26a0\ufe0f Overdue Action Items** (${overdueItems.length})\n`;
    for (const item of overdueItems) {
      const daysAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (24 * 60 * 60 * 1000));
      msg += `\u2022 [${item.priority}] ${item.title} \u2014 *${daysAgo} days overdue*\n`;
    }
    alerts.push(msg);
  }

  // 2. Check for stale approval queue items (pending > 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: staleApprovals } = await supabase
    .from('approval_queue')
    .select('action_type, target_service, reasoning, created_at')
    .eq('status', 'pending')
    .lt('created_at', oneDayAgo)
    .order('created_at', { ascending: true })
    .limit(5);

  if (staleApprovals?.length) {
    let msg = `**\ud83d\udd14 Stale Approvals** (pending > 24h)\n`;
    for (const item of staleApprovals) {
      const hoursAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (60 * 60 * 1000));
      msg += `\u2022 ${item.action_type} \u2192 ${item.target_service}: ${item.reasoning?.slice(0, 80) ?? 'No reason'} \u2014 *${hoursAgo}h ago*\n`;
    }
    alerts.push(msg);
  }

  // 3. Check for processing stuck items (context_items stuck in 'processing' > 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stuckItems } = await supabase
    .from('context_items')
    .select('title, source_type, ingested_at')
    .eq('status', 'processing')
    .lt('ingested_at', oneHourAgo)
    .limit(5);

  if (stuckItems?.length) {
    let msg = `**\ud83d\udd27 Stuck Processing** (${stuckItems.length} items)\n`;
    for (const item of stuckItems) {
      msg += `\u2022 ${item.title} (${item.source_type}) \u2014 stuck since ${new Date(item.ingested_at).toLocaleTimeString()}\n`;
    }
    alerts.push(msg);
  }

  // 4. Check for recent error items
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: errorItems } = await supabase
    .from('context_items')
    .select('title, source_type')
    .eq('status', 'error')
    .gte('ingested_at', sixHoursAgo)
    .limit(5);

  if (errorItems?.length) {
    let msg = `**\u274c Recent Errors** (last 6h)\n`;
    for (const item of errorItems) {
      msg += `\u2022 ${item.title} (${item.source_type})\n`;
    }
    alerts.push(msg);
  }

  // Only post if there are alerts
  if (alerts.length === 0) {
    return NextResponse.json({ alerts: 0, message: 'All clear' });
  }

  const fullMessage = `**Granger Alert** \u2014 ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n\n${alerts.join('\n\n')}`;

  // Split and send if over Discord's 2000 char limit
  if (fullMessage.length <= 2000) {
    await sendMessage(alertsChannelId, fullMessage);
  } else {
    for (const alert of alerts) {
      await sendMessage(alertsChannelId, alert.slice(0, 2000));
    }
  }

  return NextResponse.json({ alerts: alerts.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
