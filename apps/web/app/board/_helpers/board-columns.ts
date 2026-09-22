import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { resolveBoardSourceColumn, type BoardColumn } from '@repo/types/api/v1';

export function resolveItemColumnId(
  item: Pick<DbWorkItem, 'status' | 'board_column_id'>,
  columns: BoardColumn[]
): string | null {
  return resolveBoardSourceColumn(item, columns)?.id ?? null;
}

export function resolveBoardMove(
  item: Pick<DbWorkItem, 'status' | 'board_column_id'>,
  targetColumn: BoardColumn,
  usesCustomBoardConfig: boolean
): Pick<DbWorkItem, 'status' | 'board_column_id'> | null {
  const boardColumnId = usesCustomBoardConfig ? targetColumn.id : null;
  if (
    item.status === targetColumn.status &&
    item.board_column_id === boardColumnId
  ) {
    return null;
  }

  return {
    status: targetColumn.status,
    board_column_id: boardColumnId,
  };
}

export function assignItemsToColumns(
  workItems: DbWorkItem[],
  columns: BoardColumn[]
): Map<string, DbWorkItem[]> {
  const result = new Map<string, DbWorkItem[]>();
  for (const column of columns) {
    result.set(column.id, []);
  }

  for (const item of workItems) {
    if (item.status === 'Draft') continue;

    const columnId = resolveItemColumnId(item, columns);
    if (columnId) {
      result.get(columnId)?.push(item);
    }
  }

  return result;
}
