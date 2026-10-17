'use client';

import { useEffect, useRef } from 'react';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { createClient } from '@/lib/supabase/client';
import {
  isNewerUpdatedAt,
  mergeBoardPlacementRow,
} from '@/app/board/_helpers/board-move-pending';
import {
  shouldSubscribeBoardWorkItems,
  type BoardSyncPrefs,
} from '@/app/board/_helpers/board-sync-storage';

type UseBoardWorkItemsRealtimeOptions = {
  readonly enabled: boolean;
  readonly prefs: BoardSyncPrefs;
  readonly projectId: string | null;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly onRow: (row: Partial<DbWorkItem> & { id: string }) => void;
};

/**
 * Subscribe to work_items placement changes for the open board.
 * When `projectId` is set, filters the channel to that project.
 */
export function useBoardWorkItemsRealtime(
  options: UseBoardWorkItemsRealtimeOptions
): void {
  const { enabled, prefs, projectId, onRow } = options;
  const onRowRef = useRef(onRow);
  onRowRef.current = onRow;

  const subscribe = shouldSubscribeBoardWorkItems(prefs);

  useEffect(() => {
    if (!enabled || !subscribe) {
      return;
    }

    const supabase = createClient();
    const filter = projectId ? `project_id=eq.${projectId}` : undefined;
    const channelName = projectId
      ? `board-work-items:${projectId}`
      : 'board-work-items:all';

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
  }, [enabled, subscribe, projectId]);
}

export function applyRealtimeBoardRow(
  items: readonly DbWorkItem[],
  row: Partial<DbWorkItem> & { id: string }
): DbWorkItem[] | null {
  const index = items.findIndex((item) => item.id === row.id);
  if (index < 0) {
    return null;
  }
  const current = items[index]!;
  if (!isNewerUpdatedAt(row.updated_at, current.updated_at)) {
    return null;
  }
  const next = [...items];
  next[index] = mergeBoardPlacementRow(current, row);
  return next;
}
