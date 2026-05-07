import { createAdminClient } from '@/lib/supabase/server';

interface RecurringPattern {
  topic: string;
  occurrences: number;
  meetings: { title: string; date: string }[];
  hasResolution: boolean;
}

/**
 * Detect topics that appear in 3+ context items without resolution.
 * A topic is "unresolved" if it appears in action_items across multiple items
 * but never in decisions.
 */
export async function detectRecurringPatterns(orgId: string, days = 30): Promise<RecurringPattern[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: items } = await supabase
    .from('context_items')
    .select('title, entities, ingested_at, content_type')
    .eq('org_id', orgId)
    .eq('status', 'ready')
    .gte('ingested_at', since)
    .order('ingested_at', { ascending: false })
    .limit(100);

  if (!items?.length) return [];

  // Extract all topics and track where they appear
  const topicMap = new Map<string, { meetings: { title: string; date: string }[]; inDecisions: boolean }>();

  for (const item of items) {
    const entities = item.entities as Record<string, string[]> | null;
    if (!entities) continue;

    const topics = entities.topics ?? [];
    const decisions = entities.decisions ?? [];
    const actionItems = entities.action_items ?? [];

    // Normalize and track each topic
    for (const topic of [...topics, ...actionItems.map(a => extractTopicFromAction(a))].filter(Boolean)) {
      const normalized = topic.toLowerCase().trim();
      if (normalized.length < 3) continue;

      const existing = topicMap.get(normalized) ?? { meetings: [], inDecisions: false };
      existing.meetings.push({
        title: item.title,
        date: new Date(item.ingested_at).toLocaleDateString(),
      });

      // Check if this topic was resolved (appears in decisions)
      if (decisions.some(d => d.toLowerCase().includes(normalized))) {
        existing.inDecisions = true;
      }

      topicMap.set(normalized, existing);
    }
  }

  // Filter to topics with 3+ occurrences and no resolution
  const patterns: RecurringPattern[] = [];
  for (const [topic, data] of topicMap) {
    if (data.meetings.length >= 3) {
      patterns.push({
        topic,
        occurrences: data.meetings.length,
        meetings: data.meetings.slice(0, 5), // Cap at 5 most recent
        hasResolution: data.inDecisions,
      });
    }
  }

  // Sort by occurrences (most recurring first), unresolved first
  return patterns.sort((a, b) => {
    if (a.hasResolution !== b.hasResolution) return a.hasResolution ? 1 : -1;
    return b.occurrences - a.occurrences;
  });
}

/** Try to extract a topic keyword from an action item string */
function extractTopicFromAction(action: string): string {
  // Remove common action verbs to get the topic
  return action
    .replace(/^(follow up on|schedule|send|review|update|create|finalize|discuss|check|prepare|set up|write)\s+/i, '')
    .trim();
}
