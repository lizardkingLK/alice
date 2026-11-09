import {
  getWorkItemsHierarchyPage,
  getWorkItemsPaginated,
  type GetWorkItemsHierarchyPageResponse,
  type WorkItemListFilters,
} from '@/app/work-items/_services/work-items.reads.server';
import type { WorkItemListView } from '@/lib/search-params';

export type LoadWorkItemsListPageArgs = {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly filters?: WorkItemListFilters;
  readonly listView: WorkItemListView;
  readonly focusId?: string | null;
};

/**
 * Single registry list reader for `/work-items`, My Work, and project Work items.
 * Hierarchy always uses the forest page + `childrenByParentId` seed so expand
 * stays local. Flat returns the same response shape with an empty seed map.
 */
export async function loadWorkItemsListPage(
  args: LoadWorkItemsListPageArgs
): Promise<GetWorkItemsHierarchyPageResponse> {
  const { page, limit, search, filters, listView, focusId } = args;

  if (listView === 'hierarchy') {
    return getWorkItemsHierarchyPage(page, limit, search, filters, {
      focusId: focusId ?? null,
    });
  }

  const flat = await getWorkItemsPaginated(page, limit, search, filters);
  return {
    ...flat,
    childrenByParentId: {},
    mode: 'tree',
    searchPanelItems: [],
    searchMatchIds: [],
    ancestorsById: {},
    focusId: null,
  };
}
