'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ScopedRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export type ScopedRealtimePayload<T extends { id?: string } = { id?: string }> =
  {
    readonly eventType: ScopedRealtimeEvent;
    readonly new: T | null;
    readonly old: T | null;
  };

type UseScopedTableRealtimeOptions<T extends { id?: string }> = {
  readonly enabled: boolean;
  /** Channel name prefix, e.g. `wi-comments`. */
  readonly channelPrefix: string;
  readonly table: string;
  /**
   * PostgREST-style filter, e.g. `work_item_id=eq.<uuid>`.
   * When omitted the channel listens to the whole table.
   */
  readonly filter?: string;
  /** Scope suffix for the channel name (usually the filter target id). */
  readonly scopeKey: string;
  readonly events?: readonly ScopedRealtimeEvent[];
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onChange: (payload: ScopedRealtimePayload<T>) => void;
};

const DEFAULT_EVENTS: readonly ScopedRealtimeEvent[] = [
  'INSERT',
  'UPDATE',
  'DELETE',
];

/**
 * Subscribe to `postgres_changes` on one public table, optionally filtered.
 * Mirrors the W6/W7 `useWorkItemsRealtime` shape for feed tables.
 */
export function useScopedTableRealtime<T extends { id?: string }>(
  options: UseScopedTableRealtimeOptions<T>
): void {
  const {
    enabled,
    channelPrefix,
    table,
    filter,
    scopeKey,
    events = DEFAULT_EVENTS,
    onChange,
  } = options;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const eventsKey = events.join(',');

  useEffect(() => {
    if (!enabled || !scopeKey.trim()) {
      return;
    }

    const supabase = createClient();
    const channelName = `${channelPrefix}:${scopeKey}`;
    let channel = supabase.channel(channelName);

    for (const event of events) {
      channel = channel.on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          onChangeRef.current({
            eventType: event,
            new: (payload.new as T | null) ?? null,
            old: (payload.old as T | null) ?? null,
          });
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eventsKey serializes `events` so identity churn does not resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- events via eventsKey
  }, [enabled, channelPrefix, table, filter, scopeKey, eventsKey]);
}
