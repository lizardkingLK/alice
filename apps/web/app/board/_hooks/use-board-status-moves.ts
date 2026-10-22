'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { BoardColumn } from '@repo/types/api/v1';
import { resolveBoardMove } from '@/app/board/_helpers/board-columns';
import { mergeBoardPlacementRow } from '@/app/board/_helpers/board-move-pending';
import { handleBoardStatusMoveError } from '@/app/board/_helpers/board-status-move';
import type { BoardSyncPrefs } from '@/app/board/_helpers/board-sync-storage';
import {
  applyRealtimeBoardRow,
  useBoardWorkItemsRealtime,
} from '@/app/board/_hooks/use-board-work-items-realtime';
import { mergeWorkItemServerRow } from '@/app/work-items/_helpers/work-item-merge-server-row';
import { updateWorkItemStatus } from '@/app/work-items/_services/work-items.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { createSerialCoalesceMutationQueue } from '@/lib/work-items/serial-coalesce-mutation-queue';
import { toggleIdInSet } from '@/lib/work-items/toggle-id-in-set';
import { usePendingMutationUnload } from '@/lib/work-items/use-pending-mutation-unload';

type BoardPlacementDesired = {
  readonly status: DbWorkItem['status'];
  readonly board_column_id: string | null;
};

function placementFromItem(item: DbWorkItem): BoardPlacementDesired {
  return {
    status: item.status,
    board_column_id: item.board_column_id,
  };
}

function placementsEqual(
  a: BoardPlacementDesired,
  b: BoardPlacementDesired
): boolean {
  return a.status === b.status && a.board_column_id === b.board_column_id;
}

function columnNameForPlacement(
  placement: BoardPlacementDesired,
  columns: readonly BoardColumn[]
): string | undefined {
  if (placement.board_column_id) {
    const byId = columns.find(
      (column) => column.id === placement.board_column_id
    );
    if (byId) {
      return byId.name;
    }
  }
  return columns.find((column) => column.status === placement.status)?.name;
}

type UseBoardStatusMovesOptions = {
  readonly workItems: readonly DbWorkItem[];
  readonly setWorkItems: Dispatch<SetStateAction<DbWorkItem[]>>;
  readonly setSelectedTask: Dispatch<SetStateAction<DbWorkItem | null>>;
  readonly boardColumns: readonly BoardColumn[];
  readonly usesCustomBoardConfig: boolean;
  readonly userId: string | null;
  readonly syncPrefs: BoardSyncPrefs;
  readonly realtimeProjectId: string | null;
  readonly setStatusError: Dispatch<SetStateAction<string | null>>;
};

export function useBoardStatusMoves(options: UseBoardStatusMovesOptions): {
  readonly pendingStatusIds: ReadonlySet<string>;
  readonly dimPendingCards: boolean;
  // eslint-disable-next-line no-unused-vars -- callback
  readonly applyStatusChange: (id: string, targetColumn: BoardColumn) => void;
} {
  const {
    workItems,
    setWorkItems,
    setSelectedTask,
    boardColumns,
    usesCustomBoardConfig,
    userId,
    syncPrefs,
    realtimeProjectId,
    setStatusError,
  } = options;

  const workItemsRef = useRef(workItems);
  workItemsRef.current = workItems;
  const boardColumnsRef = useRef(boardColumns);
  boardColumnsRef.current = boardColumns;
  const usesCustomBoardConfigRef = useRef(usesCustomBoardConfig);
  usesCustomBoardConfigRef.current = usesCustomBoardConfig;
  /** Last server-acked placement — source column for error toasts (not optimistic UI). */
  const lastAckPlacementRef = useRef(
    new Map<string, BoardPlacementDesired>()
  );
  /** Labels for the in-flight flush, set in `send` before the PATCH. */
  const flushColumnLabelsRef = useRef(
    new Map<string, { source: string; target: string }>()
  );

  const [pendingStatusIds, setPendingStatusIds] = useState(
    () => new Set<string>()
  );
  const dimPendingCards = syncPrefs.syncMode === 'static';

  const restorePlacement = useCallback(
    (
      id: string,
      status: DbWorkItem['status'],
      boardColumnId: string | null
    ) => {
      setWorkItems((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                board_column_id: boardColumnId,
              }
            : item
        )
      );
      setSelectedTask((previous) =>
        previous?.id === id
          ? {
              ...previous,
              status,
              board_column_id: boardColumnId,
            }
          : previous
      );
    },
    [setSelectedTask, setWorkItems]
  );

  const syncWorkItem = useCallback(
    (id: string, updated: DbWorkItem) => {
      setWorkItems((previous) =>
        previous.map((item) =>
          item.id === id ? mergeWorkItemServerRow(item, updated) : item
        )
      );
      setSelectedTask((previous) =>
        previous?.id === id
          ? mergeWorkItemServerRow(previous, updated)
          : previous
      );
    },
    [setSelectedTask, setWorkItems]
  );

  const applyPlacementRow = useCallback(
    (row: Partial<DbWorkItem> & { id: string }, force = false) => {
      setWorkItems((previous) => {
        if (force) {
          const index = previous.findIndex((item) => item.id === row.id);
          if (index < 0) {
            return previous;
          }
          const next = [...previous];
          next[index] = mergeBoardPlacementRow(previous[index]!, row);
          return next;
        }
        return (
          applyRealtimeBoardRow(previous, row, {
            isFlushPending: (id) => moveQueueRef.current.isPending(id),
          }) ?? previous
        );
      });
      setSelectedTask((previous) => {
        if (!previous || previous.id !== row.id) {
          return previous;
        }
        if (!force && moveQueueRef.current.isPending(row.id)) {
          return previous;
        }
        return mergeBoardPlacementRow(previous, row);
      });
    },
    [setSelectedTask, setWorkItems]
  );

  const moveQueue = useMemo(
    () =>
      createSerialCoalesceMutationQueue<BoardPlacementDesired>({
        areEqual: placementsEqual,
        getAckSeed: (id) => {
          const item = workItemsRef.current.find((row) => row.id === id);
          if (!item) {
            return undefined;
          }
          const seed = placementFromItem(item);
          lastAckPlacementRef.current.set(id, seed);
          return seed;
        },
        getExpectedUpdatedAt: (id) =>
          workItemsRef.current.find((row) => row.id === id)?.updated_at,
        applyOptimistic: (id, desired) => {
          restorePlacement(id, desired.status, desired.board_column_id);
        },
        reconcileToAck: (id, ack) => {
          lastAckPlacementRef.current.set(id, ack);
          restorePlacement(id, ack.status, ack.board_column_id);
        },
        onPendingChange: (id, isPending) => {
          setPendingStatusIds((prev) => toggleIdInSet(prev, id, isPending));
        },
        onFlushError: (id, error) => {
          const labels = flushColumnLabelsRef.current.get(id);
          handleBoardStatusMoveError(
            error,
            {
              sourceColumnName: labels?.source ?? 'the current column',
              targetColumnName: labels?.target ?? 'another column',
            },
            {
              revert: () => {
                /* queue reconcileToAck handles local revert */
              },
              sync: (updated) => {
                syncWorkItem(id, updated);
              },
              applyConflictRow: (row) => {
                applyPlacementRow(row, true);
                if (
                  typeof row.status === 'string' &&
                  typeof row.updated_at === 'string'
                ) {
                  const ack = {
                    status: row.status as DbWorkItem['status'],
                    board_column_id: row.board_column_id ?? null,
                  };
                  lastAckPlacementRef.current.set(id, ack);
                  moveQueueRef.current.acknowledge(id, ack, row.updated_at);
                }
              },
              onFailure: (message) => {
                setStatusError(message);
              },
            }
          );
        },
        send: async (id, desired, expectedUpdatedAt, sendOptions) => {
          setStatusError(null);
          const ackPlacement = lastAckPlacementRef.current.get(id);
          const sourceColumnName =
            (ackPlacement &&
              columnNameForPlacement(
                ackPlacement,
                boardColumnsRef.current
              )) ??
            'the current column';
          const targetColumnName =
            columnNameForPlacement(desired, boardColumnsRef.current) ??
            'another column';
          flushColumnLabelsRef.current.set(id, {
            source: sourceColumnName,
            target: targetColumnName,
          });

          const response = await updateWorkItemStatus(
            id,
            desired.status,
            expectedUpdatedAt,
            desired.board_column_id,
            undefined,
            { keepalive: sendOptions?.keepalive === true }
          );
          if (response.error || !response.data) {
            throw new Error(
              typeof response.error === 'string'
                ? response.error
                : 'Failed to update work item status.'
            );
          }
          const synced = response.data;
          const ack = placementFromItem(synced);
          lastAckPlacementRef.current.set(id, ack);
          syncWorkItem(id, synced);
          return {
            ack,
            expectedUpdatedAt: synced.updated_at,
          };
        },
      }),
    [applyPlacementRow, restorePlacement, setStatusError, syncWorkItem]
  );
  const moveQueueRef = useRef(moveQueue);
  moveQueueRef.current = moveQueue;

  usePendingMutationUnload(moveQueue);

  useBoardWorkItemsRealtime({
    enabled: Boolean(userId),
    prefs: syncPrefs,
    projectId: realtimeProjectId,
    onRow: (row) => {
      applyPlacementRow(row);
    },
  });

  const applyStatusChange = useCallback(
    (id: string, targetColumn: BoardColumn) => {
      const currentItem = workItemsRef.current.find((item) => item.id === id);
      if (!currentItem) {
        return;
      }

      const move = resolveBoardMove(
        currentItem,
        targetColumn,
        usesCustomBoardConfigRef.current
      );
      if (!move) {
        return;
      }

      moveQueue.enqueue(id, {
        status: move.status,
        board_column_id: move.board_column_id,
      });
    },
    [moveQueue]
  );

  return {
    pendingStatusIds,
    dimPendingCards,
    applyStatusChange,
  };
}
