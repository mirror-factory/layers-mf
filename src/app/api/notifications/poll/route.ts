import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminDb = createAdminClient();

  const { data: member } = await adminDb
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!member) return NextResponse.json({ events: [], approvals: [], inbox: [] });

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Run all queries in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [eventsResult, approvalsResult, inboxResult, systemChatsResult] = await Promise.all([
    // Recent schedule completions (scheduled_actions not in DB types yet)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminDb as any)
      .from('scheduled_actions')
      .select('id, name, status, description, target_service, last_run_at')
      .eq('org_id', member.org_id)
      .gte('last_run_at', fiveMinutesAgo)
      .limit(5),

    // Recent pending approvals
    adminDb
      .from('approval_queue')
      .select('id, action_type, reasoning, created_at')
      .eq('org_id', member.org_id)
      .eq('status', 'pending')
      .gte('created_at', fiveMinutesAgo)
      .limit(5),

    // Recent unread inbox items
    adminDb
      .from('inbox_items')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .eq('status', 'unread')
      .gte('created_at', fiveMinutesAgo)
      .limit(5),

    // Recent system-initiated conversations (from schedules, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminDb as any)
      .from('conversations')
      .select('id, title, created_at, initiated_by')
      .eq('org_id', member.org_id)
      .eq('initiated_by', 'schedule')
      .gte('created_at', fiveMinutesAgo)
      .limit(5),
  ]);

  return NextResponse.json({
    events: eventsResult.data ?? [],
    approvals: approvalsResult.data ?? [],
    inbox: inboxResult.data ?? [],
    systemChats: systemChatsResult.data ?? [],
  });
}
