'use client';

import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import {
  shouldSubscribeBoardWorkItems,
  type BoardSyncPrefs,
} from '@/app/board/_helpers/board-sync-storage';
import { applyRealtimeWorkItemRow } from '@/lib/work-items/apply-realtime-work-item-row';
import { useWorkItemsRealtime } from '@/lib/work-items/use-work-items-realtime';

const BOARD_PLACEMENT_FIELDS = [
  'status',
  'board_column_id',
  'updated_by',
  'state',
] as const;

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
  const subscribe = shouldSubscribeBoardWorkItems(prefs);

  useWorkItemsRealtime({
    enabled: enabled && subscribe,
    channelPrefix: 'board-work-items',
    projectId,
    onRow,
  });
}

export function applyRealtimeBoardRow(
  items: readonly DbWorkItem[],
  row: Partial<DbWorkItem> & { id: string }
): DbWorkItem[] | null {
  return applyRealtimeWorkItemRow(items, row, BOARD_PLACEMENT_FIELDS);
}
