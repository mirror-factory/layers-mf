import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { GranolaClient } from '@/lib/api/granola';
import { extractStructured } from '@/lib/ai/extract';
import { generateEmbedding } from '@/lib/ai/embed';
import { createInboxItems } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const granolaKey = process.env.GRANOLA_API_KEY;
  if (!granolaKey) {
    return NextResponse.json({ error: 'GRANOLA_API_KEY not set' }, { status: 500 });
  }

  const supabase = createAdminClient();
  const granola = new GranolaClient(granolaKey);

  // Get the org (assuming single org for now)
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'No organization found' }, { status: 500 });
  }

  // Fetch notes from last 30 minutes (overlap window for safety)
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const records = await granola.list({ since, limit: 10 });

  let processed = 0;

  for (const record of records) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('context_items')
      .select('id')
      .eq('org_id', org.id)
      .eq('source_type', 'granola')
      .eq('source_id', record.source_id)
      .maybeSingle();

    if (existing) continue; // Skip duplicates

    // Insert as processing
    const { data: item, error } = await supabase
      .from('context_items')
      .insert({
        org_id: org.id,
        source_type: record.source_type,
        source_id: record.source_id,
        content_type: record.content_type,
        title: record.title,
        raw_content: record.raw_content,
        source_created_at: record.source_created_at,
        source_metadata: record.source_metadata,
        status: 'processing',
      })
      .select('id')
      .single();

    if (error || !item) continue;

    try {
      // Extract + embed in parallel
      const [extraction, embedding] = await Promise.all([
        extractStructured(record.raw_content, record.title),
        generateEmbedding(record.raw_content),
      ]);

      await supabase
        .from('context_items')
        .update({
          title: extraction.title,
          description_short: extraction.description_short,
          description_long: extraction.description_long,
          entities: extraction.entities,
          embedding: embedding as unknown as string,
          status: 'ready',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      // Create inbox items for all org members
      await createInboxItems(supabase, org.id, item.id, extraction, 'granola');

      // Post alert to Discord if configured
      const alertsChannelId = process.env.DISCORD_ALERTS_CHANNEL_ID;
      if (alertsChannelId) {
        const { sendMessage } = await import('@/lib/discord/api');
        const actionCount = extraction.entities.action_items?.length ?? 0;
        const decisionCount = extraction.entities.decisions?.length ?? 0;
        await sendMessage(alertsChannelId,
          `**\ud83d\udcdd New meeting processed:** ${extraction.title}\n${decisionCount} decisions, ${actionCount} action items.`
        );
      }

      processed++;
    } catch (err) {
      console.error(`Failed to process Granola note ${record.source_id}:`, err);
      await supabase.from('context_items').update({ status: 'error' }).eq('id', item.id);
    }
  }

  return NextResponse.json({ processed, fetched: records.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
