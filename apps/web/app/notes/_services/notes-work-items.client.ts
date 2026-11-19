import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';

export type NotesWorkItemOption = {
  readonly id: string;
  readonly title: string;
  readonly key: string | null;
};

type ListWorkItemsResponse = {
  readonly workItems: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly key?: string | null;
  }>;
};

/** Browse work items for Notes attach (title/key search). */
export async function searchWorkItemsForNotes(
  search: string
): Promise<NotesWorkItemOption[]> {
  const params = new URLSearchParams({
    page: '1',
    limit: '20',
    recordStatus: 'active',
  });
  const trimmed = search.trim();
  if (trimmed) {
    params.set('search', trimmed);
  }
  const result = await apiFetch<ListWorkItemsResponse>(
    `/api/work-items?${params.toString()}`
  );
  return (result.workItems ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    key: item.key ?? null,
  }));
}
