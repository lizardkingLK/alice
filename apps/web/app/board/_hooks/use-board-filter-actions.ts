'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { serializeWorkItemLabelsFilter } from '@repo/types';
import {
  applyWorkItemsProjectSprintDraftToSearchParams,
  type WorkItemsFilterDraft,
} from '@/app/work-items/_components/work-item-table/work-item-table-helpers';
import { planAppliedFilterRemovals } from '@/components/applied-filter-badges.model';
import {
  applyQueryFilterParam,
  QUERY_FILTER_ALL_VALUE,
} from '@/hooks/use-query-filter';

type UseBoardFilterActionsOptions = {
  readonly allowAllFilters: boolean;
  readonly projectsCount: number;
  readonly projectAllValue: string;
  readonly sprintAllValue: string;
  readonly activeLabels: readonly string[];
  readonly projectFilterActive: boolean;
  readonly sprintFilterActive: boolean;
  readonly hasLabelsFilter: boolean;
  readonly setSearch: Dispatch<SetStateAction<string>>;
  readonly setPriorityFilter: Dispatch<SetStateAction<string>>;
  readonly setAssigneeFilter: Dispatch<SetStateAction<string | null>>;
  /* eslint-disable no-unused-vars -- setter callbacks */
  readonly setProjectFilterValue: (value: string) => void;
  readonly setSprintFilterValue: (value: string) => void;
  readonly setLabelsFilterValue: (value: string) => void;
  /* eslint-enable no-unused-vars */
};

export function useBoardFilterActions(options: UseBoardFilterActionsOptions): {
  /* eslint-disable no-unused-vars -- public callbacks */
  readonly handleApplyFilters: (draft: WorkItemsFilterDraft) => void;
  readonly handleClearFilters: () => void;
  readonly handleRemoveAppliedFilter: (chipIds: readonly string[]) => void;
  /* eslint-enable no-unused-vars */
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    allowAllFilters,
    projectsCount,
    projectAllValue,
    sprintAllValue,
    activeLabels,
    projectFilterActive,
    sprintFilterActive,
    hasLabelsFilter,
    setSearch,
    setPriorityFilter,
    setAssigneeFilter,
    setProjectFilterValue,
    setSprintFilterValue,
    setLabelsFilterValue,
  } = options;

  const pushBoardParams = useCallback(
    (params: URLSearchParams) => {
      params.delete('page');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router]
  );

  const handleApplyFilters = useCallback(
    (draft: WorkItemsFilterDraft) => {
      setPriorityFilter(
        !draft.priority || draft.priority === QUERY_FILTER_ALL_VALUE
          ? QUERY_FILTER_ALL_VALUE
          : draft.priority
      );

      const params = new URLSearchParams(searchParams.toString());
      const canFilterProject = allowAllFilters || projectsCount > 0;

      if (canFilterProject) {
        applyWorkItemsProjectSprintDraftToSearchParams(params, draft, {
          allValue: projectAllValue,
          applyProject: true,
        });
        if (!draft.project || draft.project === projectAllValue) {
          setProjectFilterValue(projectAllValue);
          setSprintFilterValue(sprintAllValue);
        } else {
          setProjectFilterValue(draft.project);
          setSprintFilterValue(
            !draft.sprint || draft.sprint === projectAllValue
              ? sprintAllValue
              : draft.sprint
          );
        }
      } else {
        applyWorkItemsProjectSprintDraftToSearchParams(params, draft, {
          allValue: sprintAllValue,
          applyProject: false,
        });
        setSprintFilterValue(
          !draft.sprint || draft.sprint === sprintAllValue
            ? sprintAllValue
            : draft.sprint
        );
      }

      const labelsEncoded = serializeWorkItemLabelsFilter([...draft.labels]);
      applyQueryFilterParam(
        params,
        'labels',
        labelsEncoded || QUERY_FILTER_ALL_VALUE,
        QUERY_FILTER_ALL_VALUE
      );
      setLabelsFilterValue(labelsEncoded || QUERY_FILTER_ALL_VALUE);
      pushBoardParams(params);
    },
    [
      allowAllFilters,
      projectAllValue,
      projectsCount,
      pushBoardParams,
      searchParams,
      setLabelsFilterValue,
      setPriorityFilter,
      setProjectFilterValue,
      setSprintFilterValue,
      sprintAllValue,
    ]
  );

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPriorityFilter(QUERY_FILTER_ALL_VALUE);
    setAssigneeFilter(null);
    setLabelsFilterValue(QUERY_FILTER_ALL_VALUE);

    if (projectFilterActive || sprintFilterActive || hasLabelsFilter) {
      setProjectFilterValue(projectAllValue);
      setSprintFilterValue(sprintAllValue);
      const params = new URLSearchParams(searchParams.toString());
      params.set('project', projectAllValue);
      params.delete('sprint');
      params.delete('labels');
      pushBoardParams(params);
    }
  }, [
    hasLabelsFilter,
    projectAllValue,
    projectFilterActive,
    pushBoardParams,
    searchParams,
    setAssigneeFilter,
    setLabelsFilterValue,
    setPriorityFilter,
    setProjectFilterValue,
    setSearch,
    setSprintFilterValue,
    sprintAllValue,
    sprintFilterActive,
  ]);

  const handleRemoveAppliedFilter = useCallback(
    (chipIds: readonly string[]) => {
      if (chipIds.length === 0) {
        return;
      }

      const plan = planAppliedFilterRemovals(chipIds);
      const params = new URLSearchParams(searchParams.toString());

      if (plan.labelsToDrop.size > 0) {
        const nextLabels = activeLabels.filter(
          (label) => !plan.labelsToDrop.has(label)
        );
        const encoded = serializeWorkItemLabelsFilter(nextLabels);
        setLabelsFilterValue(encoded || QUERY_FILTER_ALL_VALUE);
        applyQueryFilterParam(
          params,
          'labels',
          encoded || QUERY_FILTER_ALL_VALUE,
          QUERY_FILTER_ALL_VALUE
        );
      }

      if (plan.clearSearch) {
        setSearch('');
        params.delete('search');
      }

      if (plan.clearPriority) {
        setPriorityFilter(QUERY_FILTER_ALL_VALUE);
        applyQueryFilterParam(
          params,
          'priority',
          QUERY_FILTER_ALL_VALUE,
          QUERY_FILTER_ALL_VALUE
        );
      }

      if (plan.clearAssignee) {
        setAssigneeFilter(null);
        applyQueryFilterParam(
          params,
          'assignee',
          QUERY_FILTER_ALL_VALUE,
          QUERY_FILTER_ALL_VALUE
        );
      }

      if (plan.clearProject) {
        setProjectFilterValue(projectAllValue);
        setSprintFilterValue(sprintAllValue);
        params.set('project', projectAllValue);
        params.delete('sprint');
      }

      if (plan.clearSprint && !plan.clearProject) {
        setSprintFilterValue(sprintAllValue);
        applyQueryFilterParam(
          params,
          'sprint',
          QUERY_FILTER_ALL_VALUE,
          QUERY_FILTER_ALL_VALUE
        );
      }

      pushBoardParams(params);
    },
    [
      activeLabels,
      projectAllValue,
      pushBoardParams,
      searchParams,
      setAssigneeFilter,
      setLabelsFilterValue,
      setPriorityFilter,
      setProjectFilterValue,
      setSearch,
      setSprintFilterValue,
      sprintAllValue,
    ]
  );

  return {
    handleApplyFilters,
    handleClearFilters,
    handleRemoveAppliedFilter,
  };
}
