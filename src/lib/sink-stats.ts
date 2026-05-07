/**
 * sink-stats -- in-memory ring of recent per-sink event counts.
 *
 * Used by /api/observability/health to distinguish "sink configured" from
 * "sink actually receiving events". Events are bucketed by minute and
 * truncated to the last hour.
 *
 * Every place that forwards an event to an external sink (Langfuse,
 * Supabase) should call `recordSinkEvent()` so this counter stays honest.
 */

type SinkName = 'stdout' | 'langfuse' | 'supabase' | 'file';

interface Bucket { minute: number; counts: Partial<Record<SinkName, number>> }

const RING: Bucket[] = [];
const MAX_MINUTES = 60;

function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

export function recordSinkEvent(sink: SinkName): void {
  const minute = currentMinute();
  let bucket = RING[RING.length - 1];
  if (!bucket || bucket.minute !== minute) {
    bucket = { minute, counts: {} };
    RING.push(bucket);
    // Drop buckets older than MAX_MINUTES.
    const cutoff = minute - MAX_MINUTES;
    while (RING.length > 0 && RING[0].minute < cutoff) RING.shift();
  }
  bucket.counts[sink] = (bucket.counts[sink] ?? 0) + 1;
}

export function getSinkStats(): Record<SinkName, number> {
  const totals: Record<SinkName, number> = { stdout: 0, langfuse: 0, supabase: 0, file: 0 };
  for (const bucket of RING) {
    for (const [sink, count] of Object.entries(bucket.counts)) {
      totals[sink as SinkName] += count ?? 0;
    }
  }
  return totals;
}
