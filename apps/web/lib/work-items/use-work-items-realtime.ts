'use client';

import { useEffect, useRef } from 'react';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { createClient } from '@/lib/supabase/client';

type UseWorkItemsRealtimeOptions = {
  readonly enabled: boolean;
  /** Channel name prefix, e.g. `board-work-items` or `calendar-work-items`. */
  readonly channelPrefix: string;
  readonly projectId: string | null;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onRow: (row: Partial<DbWorkItem> & { id: string }) => void;
};

/**
 * Subscribe to `work_items` UPDATE via Supabase realtime.
 * When `projectId` is set, filters the channel to that project.
 */
export function useWorkItemsRealtime(
  options: UseWorkItemsRealtimeOptions
): void {
  const { enabled, channelPrefix, projectId, onRow } = options;
  const onRowRef = useRef(onRow);
  onRowRef.current = onRow;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = createClient();
    const filter = projectId ? `project_id=eq.${projectId}` : undefined;
    const channelName = projectId
      ? `${channelPrefix}:${projectId}`
      : `${channelPrefix}:all`;

    const channel = supabase.channel(channelName).on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'work_items',
        ...(filter ? { filter } : {}),
      },
      (payload) => {
        const row = payload.new as Partial<DbWorkItem> & { id?: string };
        if (!row?.id || typeof row.id !== 'string') {
          return;
        }
        onRowRef.current({ ...row, id: row.id });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, channelPrefix, projectId]);
}
