import { cache } from 'react';
import {
  getWorkItemFromApi,
  listWorkItemsPaginatedFromApi,
} from '@/app/work-items/_services/work-items.reads.api.server';
import {
  collectSubtreeItems,
  groupWorkItemsByParentId,
  seedForestChildrenByParentId,
} from '@/app/work-items/_helpers/work-item-hierarchy-children';
import {
  buildSearchPanelItems,
  HIERARCHY_FOREST_PAGE_SIZE,
  indexWorkItemsById,
  missingAncestorIds,
  sliceForestPage,
  walkForestDfs,
} from '@/app/work-items/_helpers/work-item-hierarchy-forest';
import {
  applyWorkItemFilters,
  getWorkItemAncestorsFromSupabase,
  getWorkItemFromSupabase,
  getWorkItemsFromSupabase,
  getWorkItemsHierarchyPageFromRpc,
  listWorkItemsPaginatedFromSupabase,
} from '@/app/work-items/_services/work-items.reads.supabase.server';
import type {
  DbWorkItem,
  GetWorkItemsHierarchyPageOptions,
  GetWorkItemsHierarchyPageResponse,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';

export type {
  DbWorkItem,
  GetWorkItemsHierarchyPageOptions,
  GetWorkItemsHierarchyPageResponse,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
};

export { applyWorkItemFilters, HIERARCHY_FOREST_PAGE_SIZE };

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations use `work-items.mutations.client.ts`.
 */
export async function getWorkItems(
  filters?: WorkItemListFilters,
  options?: GetWorkItemsOptions
): Promise<DbWorkItem[]> {
  // Unpaginated list is still Supabase-only (calendar / board / sprint report).
  return getWorkItemsFromSupabase(filters, options);
}

export async function getWorkItemsPaginated(
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters
): Promise<GetWorkItemsPaginatedResponse> {
  if (shouldReadViaApi('work-items')) {
    return listWorkItemsPaginatedFromApi(page, limit, search, filters);
  }

  return listWorkItemsPaginatedFromSupabase(page, limit, search, filters);
}

function forestCandidateFilters(
  filters?: WorkItemListFilters
): WorkItemListFilters | undefined {
  if (!filters) {
    return undefined;
  }
  const next: WorkItemListFilters = { ...filters };
  delete next.parentId;
  delete next.parentIds;
  return next;
}

async function backfillMissingAncestors(
  seed: readonly DbWorkItem[],
  scope: WorkItemListFilters | undefined
): Promise<Map<string, DbWorkItem>> {
  const byId = indexWorkItemsById(seed);
  let missing = missingAncestorIds(seed, byId);
  let guard = 0;

  while (missing.length > 0 && guard < 8) {
    guard += 1;
    const fetched = await getWorkItems({
      ...scope,
      ids: missing,
      parentId: undefined,
      parentIds: undefined,
    });
    if (fetched.length === 0) {
      break;
    }
    for (const item of fetched) {
      byId.set(item.id, item);
    }
    missing = missingAncestorIds([...byId.values()], byId);
  }

  return byId;
}

function emptyHierarchyPage(
  page: number,
  limit: number,
  mode: 'tree' | 'search',
  focusId: string | null
): GetWorkItemsHierarchyPageResponse {
  return {
    workItems: [],
    totalCount: 0,
    page,
    limit,
    totalPages: 1,
    childrenByParentId: {},
    mode,
    searchPanelItems: [],
    searchMatchIds: [],
    ancestorsById: {},
    focusId,
  };
}

function ancestorsFromWalk(
  itemId: string,
  walkById: ReadonlyMap<
    string,
    { readonly ancestors: readonly WorkItemAncestor[] }
  >
): WorkItemAncestor[] {
  return [...(walkById.get(itemId)?.ancestors ?? [])];
}

/**
 * Drilldown: focused item + full filtered descendant forest, fully seeded so
 * expand never hits `loadWorkItemChildrenAction`.
 */
async function getHierarchyFocusPage(
  focusId: string,
  limit: number,
  search: string | null,
  filters: WorkItemListFilters | undefined
): Promise<GetWorkItemsHierarchyPageResponse> {
  const scope = forestCandidateFilters(filters);
  const mode = search ? 'search' : 'tree';

  const [candidates, matches] = await Promise.all([
    getWorkItems(scope),
    search
      ? getWorkItems(scope, { search })
      : Promise.resolve([] as DbWorkItem[]),
  ]);

  const byId = indexWorkItemsById(candidates);
  let focused = byId.get(focusId);
  if (!focused) {
    const fetched = await getWorkItems({
      ...scope,
      ids: [focusId],
    });
    focused = fetched[0];
    if (focused) {
      byId.set(focused.id, focused);
    }
  }
  if (!focused) {
    return emptyHierarchyPage(1, limit, mode, focusId);
  }

  const byParent = groupWorkItemsByParentId([...byId.values()]);
  const subtree = collectSubtreeItems(focusId, byId, byParent);
  const subtreeWalk = walkForestDfs(subtree);
  const walkById = new Map(
    subtreeWalk.map((entry) => [entry.workItem.id, entry] as const)
  );

  let searchPanelItems: DbWorkItem[] = [];
  let searchMatchIds: string[] = [];
  if (search && matches.length > 0) {
    const panelById = await backfillMissingAncestors(matches, {
      recordStatus: scope?.recordStatus,
      projectId: scope?.projectId,
      projectIds: scope?.projectIds,
    });
    const panel = buildSearchPanelItems(matches, panelById);
    searchPanelItems = panel.panelItems;
    searchMatchIds = [...panel.matchIds];
  }

  return {
    workItems: [focused],
    totalCount: 1,
    page: 1,
    limit,
    totalPages: 1,
    childrenByParentId: seedForestChildrenByParentId(subtree),
    mode,
    searchPanelItems,
    searchMatchIds,
    ancestorsById: {
      [focused.id]: ancestorsFromWalk(focusId, walkById),
    },
    focusId,
  };
}

/** In-memory forest walk — used when the hierarchy RPC is not deployed yet. */
async function getHierarchyBrowsePageFallback(
  page: number,
  filters?: WorkItemListFilters
): Promise<GetWorkItemsHierarchyPageResponse> {
  const candidates = await getWorkItems(forestCandidateFilters(filters));
  const ordered = walkForestDfs(candidates);
  const sliced = sliceForestPage(ordered, page, HIERARCHY_FOREST_PAGE_SIZE);
  const ancestorsById: Record<string, WorkItemAncestor[]> = {};
  for (const entry of sliced.items) {
    ancestorsById[entry.workItem.id] = [...entry.ancestors];
  }
  const pageItems = sliced.items.map((entry) => entry.workItem);

  return {
    workItems: [...sliced.pageRoots],
    totalCount: sliced.totalCount,
    page: sliced.page,
    limit: sliced.limit,
    totalPages: sliced.totalPages,
    childrenByParentId: seedForestChildrenByParentId(pageItems),
    mode: 'tree',
    searchPanelItems: [],
    searchMatchIds: [],
    ancestorsById,
    focusId: null,
  };
}

async function getHierarchySearchPageFallback(
  page: number,
  limit: number,
  search: string,
  filters: WorkItemListFilters | undefined
): Promise<GetWorkItemsHierarchyPageResponse> {
  const scope = forestCandidateFilters(filters);
  const matches = await getWorkItems(scope, { search });
  const byId = await backfillMissingAncestors(matches, {
    recordStatus: scope?.recordStatus,
    projectId: scope?.projectId,
    projectIds: scope?.projectIds,
  });

  const { panelItems, matchIds } = buildSearchPanelItems(matches, byId);
  const panelWalk = walkForestDfs(panelItems);
  const walkById = new Map(
    panelWalk.map((entry) => [entry.workItem.id, entry] as const)
  );

  const totalCount = matches.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const pageMatches = matches.slice(start, start + limit);

  const ancestorsById: Record<string, WorkItemAncestor[]> = {};
  for (const item of pageMatches) {
    ancestorsById[item.id] = ancestorsFromWalk(item.id, walkById);
  }

  return {
    workItems: pageMatches,
    totalCount,
    page: safePage,
    limit,
    totalPages,
    childrenByParentId: seedForestChildrenByParentId(panelItems),
    mode: 'search',
    searchPanelItems: panelItems,
    searchMatchIds: [...matchIds],
    ancestorsById,
    focusId: null,
  };
}

/**
 * Hierarchy list page: prefers `get_work_items_hierarchy_page` RPC (one SQL
 * shape + list hydrate). Focus drilldown always loads the full filtered
 * subtree once and seeds expand locally. Falls back to in-memory DFS when the
 * migration is not applied yet.
 */
export async function getWorkItemsHierarchyPage(
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters,
  options?: GetWorkItemsHierarchyPageOptions
): Promise<GetWorkItemsHierarchyPageResponse> {
  const focusId = options?.focusId?.trim() || null;
  const trimmedSearch = search?.trim() || null;
  const safeLimit = Math.max(1, limit);

  if (focusId) {
    return getHierarchyFocusPage(focusId, safeLimit, trimmedSearch, filters);
  }

  const scope = forestCandidateFilters(filters);
  const fromRpc = await getWorkItemsHierarchyPageFromRpc(
    page,
    safeLimit,
    trimmedSearch ?? undefined,
    scope,
    null
  );
  if (fromRpc) {
    return fromRpc;
  }

  if (trimmedSearch) {
    return getHierarchySearchPageFallback(
      page,
      safeLimit,
      trimmedSearch,
      filters
    );
  }

  return getHierarchyBrowsePageFallback(page, filters);
}

export const getWorkItem = cache(
  async (workItemId: string): Promise<DbWorkItem | null> => {
    if (shouldReadViaApi('work-items')) {
      return getWorkItemFromApi(workItemId);
    }

    return getWorkItemFromSupabase(workItemId);
  }
);

/**
 * Ancestors root-first (Epic → … → immediate parent) for the details path crumb.
 * One PostgREST round-trip (nested parent embeds).
 */
export async function getWorkItemAncestors(
  parentId: string | null | undefined
): Promise<WorkItemAncestor[]> {
  return getWorkItemAncestorsFromSupabase(parentId);
}
