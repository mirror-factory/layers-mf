import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { LinearApiClient } from '@/lib/api/linear';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/linear-check
 * Runs every 3 minutes via Vercel cron. Queries Linear for recent issue updates,
 * builds a status summary, and stores it as a context item for search + notifications.
 *
 * NOTE: Requires a `scheduled_actions` row with name='Linear Status Check'
 * to trigger desktop notifications. Seed via Supabase dashboard or MCP:
 *
 *   INSERT INTO scheduled_actions (org_id, name, description, action_type,
 *     target_service, schedule, status, created_by)
 *   VALUES ('<org_id>', 'Linear Status Check',
 *     'Checks Linear for issue updates every 3 minutes',
 *     'cron', 'linear', '*​/3 * * * *', 'active', '<user_id>');
 */
export async function GET(request: NextRequest) {
  // Allow both cron secret and open access for demo mode
  const authHeader = request.headers.get('authorization');
  const demoMode = process.env.DEMO_MODE === 'true';
  if (!demoMode && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get org
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();
  if (!org) return NextResponse.json({ error: 'No org' }, { status: 500 });

  // Get Linear credentials (org-level or first user's)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cred } = await (supabase as any)
    .from('credentials')
    .select('token_encrypted')
    .eq('org_id', org.id)
    .eq('provider', 'linear')
    .limit(1)
    .single();

  if (!cred) {
    return NextResponse.json({ error: 'No Linear credentials', skipped: true });
  }

  try {
    const client = new LinearApiClient(cred.token_encrypted);
    const issues = await client.listIssues({ limit: 15 });

    // Build a summary
    const summary = {
      total: issues.length,
      byStatus: {} as Record<string, number>,
      urgent: [] as string[],
      recentlyUpdated: [] as { id: string; title: string; status: string; url: string }[],
    };

    for (const issue of issues) {
      const status = issue.state?.name ?? 'Unknown';
      summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
      if (issue.priority <= 1) {
        summary.urgent.push(`${issue.identifier}: ${issue.title}`);
      }
      summary.recentlyUpdated.push({
        id: issue.identifier,
        title: issue.title,
        status,
        url: issue.url,
      });
    }

    // Build result content as markdown
    const resultTitle = `Linear Status — ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    const descriptionShort = `${issues.length} issues: ${summary.urgent.length} urgent, ${Object.entries(summary.byStatus).map(([s, c]) => `${c} ${s}`).join(', ')}`;
    const resultContent = [
      `# ${resultTitle}`,
      '',
      `**${issues.length} issues** across ${Object.keys(summary.byStatus).length} statuses.`,
      '',
      ...Object.entries(summary.byStatus).map(([status, count]) => `- **${status}**: ${count}`),
      '',
      summary.urgent.length > 0
        ? `## Urgent\n${summary.urgent.map(u => `- ${u}`).join('\n')}`
        : '',
      '',
      '## Recently Updated',
      ...summary.recentlyUpdated.slice(0, 10).map(i => `- [${i.id}](${i.url}) ${i.title} — *${i.status}*`),
    ].filter(Boolean).join('\n');

    // Upsert context item (replace previous check)
    await supabase
      .from('context_items')
      .upsert({
        org_id: org.id,
        source_type: 'linear',
        source_id: 'linear-status-check',
        content_type: 'document',
        title: resultTitle,
        raw_content: resultContent,
        description_short: descriptionShort,
        status: 'ready',
        ingested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      }, { onConflict: 'org_id,source_type,source_id' });

    // Update the scheduled_action's last_run_at so notifications fire
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('scheduled_actions')
      .update({
        last_run_at: new Date().toISOString(),
        description: descriptionShort,
      })
      .eq('org_id', org.id)
      .eq('name', 'Linear Status Check');

    return NextResponse.json({
      success: true,
      summary: {
        total: issues.length,
        urgent: summary.urgent.length,
        statuses: summary.byStatus,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[linear-check] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
