/**
 * Supabase Realtime Hook
 *
 * Provides live subscriptions to dashboard data via Supabase Realtime.
 * Subscribes to INSERT/UPDATE events on traces, spans, cost_logs, eval_runs,
 * and connector_status tables. RLS-filtered per tenant.
 *
 * Usage in dashboard pages:
 *   const { traces, costLogs } = useRealtimeData();
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────

interface RealtimeEvent {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

interface RealtimeConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  tables?: string[];
  onEvent?: (event: RealtimeEvent) => void;
}

interface RealtimeState {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  eventCount: number;
  traces: Record<string, unknown>[];
  costLogs: Record<string, unknown>[];
  evalRuns: Record<string, unknown>[];
}

// ── Default config ────────────────────────────────────────────────────

const DEFAULT_TABLES = [
  'traces',
  'spans',
  'cost_logs',
  'eval_runs',
  'connector_status',
  'regression_tests',
];

// ── Hook ──────────────────────────────────────────────────────────────

export function useRealtimeData(config?: RealtimeConfig): RealtimeState & {
  refresh: () => void;
} {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    lastEvent: null,
    eventCount: 0,
    traces: [],
    costLogs: [],
    evalRuns: [],
  });

  const channelRef = useRef<unknown>(null);

  const refresh = useCallback(() => {
    // Trigger re-fetch of dashboard data
    setState(prev => ({ ...prev, eventCount: prev.eventCount + 1 }));
  }, []);

  useEffect(() => {
    const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      // No Supabase configured -- realtime not available
      return;
    }

    let cleanup = false;

    async function setupRealtime() {
      try {
        // Dynamic import to avoid bundling Supabase when not needed
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(url!, key!);

        const tables = config?.tables ?? DEFAULT_TABLES;

        const channel = supabase
          .channel('ai-dev-kit-dashboard')
          .on(
            'postgres_changes' as any,
            { event: '*', schema: 'public', table: tables[0] },
            (payload: any) => handleEvent(payload, tables[0]),
          );

        // Subscribe to additional tables
        for (let i = 1; i < tables.length; i++) {
          channel.on(
            'postgres_changes' as any,
            { event: '*', schema: 'public', table: tables[i] },
            (payload: any) => handleEvent(payload, tables[i]),
          );
        }

        channel.subscribe((status: string) => {
          if (!cleanup) {
            setState(prev => ({ ...prev, connected: status === 'SUBSCRIBED' }));
          }
        });

        channelRef.current = { channel, supabase };
      } catch {
        // Supabase not available
      }
    }

    function handleEvent(payload: any, table: string) {
      if (cleanup) return;

      const event: RealtimeEvent = {
        table,
        eventType: payload.eventType,
        new: payload.new ?? {},
        old: payload.old ?? {},
      };

      setState(prev => {
        const updated = { ...prev, lastEvent: event, eventCount: prev.eventCount + 1 };

        // Accumulate recent events by table
        if (table === 'traces') {
          updated.traces = [event.new, ...prev.traces].slice(0, 50);
        } else if (table === 'cost_logs') {
          updated.costLogs = [event.new, ...prev.costLogs].slice(0, 50);
        } else if (table === 'eval_runs') {
          updated.evalRuns = [event.new, ...prev.evalRuns].slice(0, 50);
        }

        return updated;
      });

      // Notify external handler
      config?.onEvent?.(event);
    }

    setupRealtime();

    return () => {
      cleanup = true;
      if (channelRef.current) {
        const { channel, supabase } = channelRef.current as any;
        supabase.removeChannel(channel);
      }
    };
  }, [config?.supabaseUrl, config?.supabaseAnonKey]);

  return { ...state, refresh };
}

// ── Realtime indicator component ──────────────────────────────────────

export function RealtimeIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ fontFamily: 'var(--mono, monospace)' }}>
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: connected ? '#3dffc0' : '#555',
          boxShadow: connected ? '0 0 6px rgba(61,255,192,.5)' : 'none',
        }}
      />
      <span style={{ color: connected ? '#3dffc0' : '#555' }}>
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
