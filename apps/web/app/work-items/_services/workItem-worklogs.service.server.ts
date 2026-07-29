import { createClient } from '@/lib/supabase/server';
import { isMissingRelationError, throwIfError } from '@/lib/db/query';
import {
  WORK_ITEM_WORKLOG_SELECT,
  normalizeWorkLogRow,
  type WorkItemWorkLog,
  type WorkItemWorkLogRowRaw,
} from '@repo/types';

export type { WorkItemWorkLog };

export async function getWorkItemWorkLogs(
  workItemId: string
): Promise<WorkItemWorkLog[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_item_worklogs' as unknown as never)
    .select(WORK_ITEM_WORKLOG_SELECT)
    .eq('work_item_id', workItemId)
    .order('logged_at', { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        'warn. work_item_worklogs is not available yet; returning empty work logs. Apply the add_work_item_worklogs migration to enable time tracking.'
      );
      return [];
    }

    throwIfError(
      error,
      'failed to list work item work logs',
      'Failed to list work logs'
    );
  }

  const rows = (data ?? []) as unknown as WorkItemWorkLogRowRaw[];
  return rows.map((row) => normalizeWorkLogRow(row));
}
