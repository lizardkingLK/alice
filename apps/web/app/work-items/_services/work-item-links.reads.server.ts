import type { WorkItemLinkListItem } from '@repo/types';
import { getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';

/**
 * RSC prefetch for peer links on work-item details (API-only; new table).
 */
export async function getWorkItemLinks(
  workItemId: string
): Promise<WorkItemLinkListItem[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    (async () => {
      const result = await apiFetch<{
        data: WorkItemLinkListItem[] | null;
        error: string | null;
      }>(`/api/work-items/${workItemId}/links`);
      return result.data ?? [];
    })(),
    [],
    `fetch links for work item ${workItemId}`
  );
}
