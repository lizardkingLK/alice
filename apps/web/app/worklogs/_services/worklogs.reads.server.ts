import type { WorkItemWorkLog } from '@repo/types';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { getWorkItemWorkLogsFromApi } from './worklogs.reads.api.server';
import { getWorkItemWorkLogsFromSupabase } from './worklogs.reads.supabase.server';

export type { WorkItemWorkLog };

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations use `worklogs.mutations.client.ts`.
 */
export async function getWorkItemWorkLogs(
  workItemId: string
): Promise<WorkItemWorkLog[]> {
  if (shouldReadViaApi('worklogs')) {
    return getWorkItemWorkLogsFromApi(workItemId);
  }

  return getWorkItemWorkLogsFromSupabase(workItemId);
}
