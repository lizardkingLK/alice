'use client';

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { BoardColumn } from '@repo/types/api/v1';
import {
  resolveBoardMove,
  resolveItemColumnId,
} from '@/app/board/_helpers/board-columns';
import {
  clearPendingAttempt,
  createBoardMoveAttemptId,
  mergeBoardPlacementRow,
  upsertPendingAttempt,
  type BoardMovePendingAttempt,
} from '@/app/board/_helpers/board-move-pending';
import {
  handleBoardStatusMoveError,
  handleBoardStatusMoveResponse,
} from '@/app/board/_helpers/board-status-move';
import type { BoardSyncPrefs } from '@/app/board/_helpers/board-sync-storage';
import {
  applyRealtimeBoardRow,
  useBoardWorkItemsRealtime,
} from '@/app/board/_hooks/use-board-work-items-realtime';
import { mergeWorkItemServerRow } from '@/app/work-items/_helpers/work-item-merge-server-row';
import { updateWorkItemStatus } from '@/app/work-items/_services/work-items.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

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

  const [pendingAttempts, setPendingAttempts] = useState<
    Map<string, BoardMovePendingAttempt>
  >(() => new Map());
  const pendingStatusIds = useMemo(
    () => new Set(pendingAttempts.keys()),
    [pendingAttempts]
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
                updated_at: item.updated_at,
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
              updated_at: previous.updated_at,
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
        return applyRealtimeBoardRow(previous, row) ?? previous;
      });
      setSelectedTask((previous) => {
        if (!previous || previous.id !== row.id) {
          return previous;
        }
        return mergeBoardPlacementRow(previous, row);
      });
      setPendingAttempts((previous) => clearPendingAttempt(previous, row.id));
    },
    [setSelectedTask, setWorkItems]
  );

  useBoardWorkItemsRealtime({
    enabled: Boolean(userId),
    prefs: syncPrefs,
    projectId: realtimeProjectId,
    onRow: applyPlacementRow,
  });

  const applyStatusChange = useCallback(
    (id: string, targetColumn: BoardColumn) => {
      const currentItem = workItems.find((item) => item.id === id);
      if (!currentItem || pendingAttempts.has(id)) {
        return;
      }

      const move = resolveBoardMove(
        currentItem,
        targetColumn,
        usesCustomBoardConfig
      );
      if (!move) {
        return;
      }

      const attempt: BoardMovePendingAttempt = {
        attemptId: createBoardMoveAttemptId(),
        workItemId: id,
        previousStatus: currentItem.status,
        previousBoardColumnId: currentItem.board_column_id,
        previousUpdatedAt: currentItem.updated_at,
        targetStatus: move.status,
        targetBoardColumnId: move.board_column_id,
      };
      const sourceColumnName =
        boardColumns.find(
          (column) =>
            column.id === resolveItemColumnId(currentItem, boardColumns)
        )?.name ?? 'the current column';

      setStatusError(null);
      setPendingAttempts((previous) => upsertPendingAttempt(previous, attempt));
      restorePlacement(id, move.status, move.board_column_id);

      const handlers = {
        revert: () => {
          restorePlacement(
            id,
            attempt.previousStatus,
            attempt.previousBoardColumnId
          );
        },
        sync: (updated: DbWorkItem) => {
          syncWorkItem(id, updated);
        },
        applyConflictRow: (row: Partial<DbWorkItem> & { id: string }) => {
          applyPlacementRow(row, true);
        },
        onFailure: (message: string) => {
          setStatusError(message);
        },
      };

      updateWorkItemStatus(
        id,
        move.status,
        currentItem.updated_at,
        move.board_column_id
      )
        .then((response) => {
          handleBoardStatusMoveResponse(response, handlers);
        })
        .catch((error) => {
          handleBoardStatusMoveError(
            error,
            {
              sourceColumnName,
              targetColumnName: targetColumn.name,
            },
            handlers
          );
        })
        .finally(() => {
          setPendingAttempts((previous) =>
            clearPendingAttempt(previous, id, attempt.attemptId)
          );
        });
    },
    [
      applyPlacementRow,
      boardColumns,
      pendingAttempts,
      restorePlacement,
      setStatusError,
      syncWorkItem,
      usesCustomBoardConfig,
      workItems,
    ]
  );

  return {
    pendingStatusIds,
    dimPendingCards,
    applyStatusChange,
  };
}
