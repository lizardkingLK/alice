'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  preferenceToProjectFilter,
  preferenceToSprintFilter,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseBacklogProjectDefaultsOptions = {
  readonly userId: string | null;
  readonly projects: readonly DbProject[];
  readonly sprints: readonly Sprint[];
};

export function useBacklogProjectDefaults({
  userId,
  projects,
  sprints,
}: UseBacklogProjectDefaultsOptions) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('');

  const applyPreferenceFilters = useCallback(
    (preference: BoardDefaultsPreference | null) => {
      if (!preference) {
        setProjectFilter('all');
        setSprintFilter('');
        return;
      }
      setProjectFilter(preferenceToProjectFilter(preference));
      setSprintFilter(preferenceToSprintFilter(preference));
    },
    []
  );

  const { savedPreference, saveDefaults, consumeBootstrap } =
    useWorkspaceDefaultsSession({
      userId,
      projects,
      sprints,
    });

  useEffect(() => {
    const boot = consumeBootstrap();
    if (!boot) {
      return;
    }
    applyPreferenceFilters(boot.preference);
  }, [applyPreferenceFilters, consumeBootstrap]);

  const updateProjectFilter = useCallback(
    (nextProjectFilter: string, nextSprintFilter?: string) => {
      setProjectFilter(nextProjectFilter);
      if (nextSprintFilter !== undefined) {
        setSprintFilter(
          nextSprintFilter === 'all' || !nextSprintFilter
            ? ''
            : nextSprintFilter
        );
        return;
      }
      if (nextProjectFilter === 'all') {
        setSprintFilter('');
        return;
      }
      if (!sprintFilter) {
        return;
      }
      const sprint = sprints.find((entry) => entry.id === sprintFilter);
      if (sprint?.project?.id !== nextProjectFilter) {
        setSprintFilter('');
      }
    },
    [sprintFilter, sprints]
  );

  const updateSprintFilter = useCallback((nextSprintFilter: string) => {
    setSprintFilter(
      nextSprintFilter === 'all' || !nextSprintFilter ? '' : nextSprintFilter
    );
  }, []);

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceToProjectFilter(savedPreference) === projectFilter &&
    preferenceToSprintFilter(savedPreference) === sprintFilter;

  const resetFiltersToDefaults = useCallback(() => {
    applyPreferenceFilters(savedPreference);
  }, [applyPreferenceFilters, savedPreference]);

  return {
    projectFilter,
    setProjectFilter: updateProjectFilter,
    sprintFilter,
    setSprintFilter: updateSprintFilter,
    savedPreference,
    savedDefaultsApplied,
    saveDefaults,
    resetFiltersToDefaults,
  };
}
