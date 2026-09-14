import { describe, expect, it } from 'vitest';
import {
  applyWorkItemsFilterDraftToSearchParams,
  hasActiveWorkItemFilters,
  type WorkItemsFilterDraft,
} from '@/app/work-items/_components/work-item-table/work-item-table-helpers';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

const all = QUERY_FILTER_ALL_VALUE;

function draft(
  overrides: Partial<WorkItemsFilterDraft> = {}
): WorkItemsFilterDraft {
  return {
    project: all,
    sprint: all,
    type: all,
    assignee: all,
    labels: [],
    priority: all,
    ...overrides,
  };
}

describe('applyWorkItemsFilterDraftToSearchParams', () => {
  it('writes sprint when project is locked without changing project', () => {
    const params = new URLSearchParams({
      tab: 'work-items',
      project: 'proj-1',
    });

    applyWorkItemsFilterDraftToSearchParams(
      params,
      draft({ project: 'proj-1', sprint: 'sprint-2' }),
      {
        allValue: all,
        isProjectLocked: true,
        isAssigneeLocked: false,
        listView: 'flat',
      }
    );

    expect(params.get('project')).toBe('proj-1');
    expect(params.get('sprint')).toBe('sprint-2');
    expect(params.get('page')).toBe('1');
  });

  it('clears sprint when project is locked and draft sprint is all', () => {
    const params = new URLSearchParams({
      tab: 'work-items',
      project: 'proj-1',
      sprint: 'sprint-2',
    });

    applyWorkItemsFilterDraftToSearchParams(
      params,
      draft({ project: 'proj-1', sprint: all }),
      {
        allValue: all,
        isProjectLocked: true,
        isAssigneeLocked: false,
        listView: 'flat',
      }
    );

    expect(params.get('project')).toBe('proj-1');
    expect(params.get('sprint')).toBeNull();
  });
});

describe('hasActiveWorkItemFilters', () => {
  it('treats sprint as an active filter when project is locked', () => {
    const searchParams = new URLSearchParams({
      project: 'proj-1',
      sprint: 'sprint-2',
    });

    expect(
      hasActiveWorkItemFilters({
        searchParams,
        isProjectLocked: true,
        isAssigneeLocked: false,
        showWorkspaceDefaults: false,
        urlFiltersActive: false,
      })
    ).toBe(true);
  });

  it('ignores locked project param when checking active filters', () => {
    const searchParams = new URLSearchParams({ project: 'proj-1' });

    expect(
      hasActiveWorkItemFilters({
        searchParams,
        isProjectLocked: true,
        isAssigneeLocked: false,
        showWorkspaceDefaults: false,
        urlFiltersActive: false,
      })
    ).toBe(false);
  });
});
