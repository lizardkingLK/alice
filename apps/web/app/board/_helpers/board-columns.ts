import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { BoardColumn } from '@repo/types/api/v1';

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

    // Temporary first-match behavior for columns mapped to the same status.
    const matchingColumn = columns.find(
      (column) => column.status === item.status
    );
    if (matchingColumn) {
      result.get(matchingColumn.id)?.push(item);
    }
  }

  return result;
}
