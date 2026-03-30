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
  const [eventsResult, approvalsResult, inboxResult] = await Promise.all([
    // Recent schedule completions
    adminDb
      .from('scheduled_actions')
      .select('id, name, status, last_run_at')
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
  ]);

  return NextResponse.json({
    events: eventsResult.data ?? [],
    approvals: approvalsResult.data ?? [],
    inbox: inboxResult.data ?? [],
  });
}
