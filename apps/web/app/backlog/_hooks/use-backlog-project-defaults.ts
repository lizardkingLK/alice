'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  preferenceToProjectFilter,
  preferenceToSprintFilter,
  projectFilterToPreference,
  resolveBaselineProjectFilter,
  resolveBaselineSprintFilter,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseBacklogProjectDefaultsOptions = {
  readonly userId: string | null;
  readonly projects: readonly DbProject[];
  readonly sprints: readonly Sprint[];
  readonly suggestedDefaults: BoardDefaultsPreference | null;
};

export function useBacklogProjectDefaults({
  userId,
  projects,
  sprints,
  suggestedDefaults,
}: UseBacklogProjectDefaultsOptions) {
  const [projectFilter, setProjectFilterState] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('');

  const applyPreferenceFilters = useCallback(
    (preference: BoardDefaultsPreference) => {
      setProjectFilterState(preferenceToProjectFilter(preference));
      setSprintFilter(preferenceToSprintFilter(preference));
    },
    []
  );

  const {
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedPreference,
    handleSaveDefaults,
    handleSkipDefaults,
    handleClearDefaults,
    promptDefaultsDialog,
    canClearDefaults,
    consumeBootstrap,
    openDefaultsDialog: openSessionDefaultsDialog,
  } = useWorkspaceDefaultsSession({
    userId,
    projects,
    sprints,
    onSave: applyPreferenceFilters,
  });

  useEffect(() => {
    const boot = consumeBootstrap();
    if (!boot) {
      return;
    }

    const { record, validated } = boot;

    if (validated) {
      applyPreferenceFilters(validated);
    } else if (suggestedDefaults) {
      applyPreferenceFilters(suggestedDefaults);
    }

    if (!record?.prompted && !validated && suggestedDefaults) {
      promptDefaultsDialog(suggestedDefaults, true);
    }
  }, [
    applyPreferenceFilters,
    consumeBootstrap,
    promptDefaultsDialog,
    suggestedDefaults,
  ]);

  const setProjectFilter = useCallback(
    (nextProjectFilter: string) => {
      setProjectFilterState(nextProjectFilter);
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

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceToProjectFilter(savedPreference) === projectFilter &&
    preferenceToSprintFilter(savedPreference) === sprintFilter;

  const openDefaultsDialog = useCallback(() => {
    openSessionDefaultsDialog(
      projectFilterToPreference(projectFilter, sprintFilter)
    );
  }, [openSessionDefaultsDialog, projectFilter, sprintFilter]);

  const baselineProjectId = resolveBaselineProjectFilter(
    savedPreference,
    suggestedDefaults
  );
  const baselineSprintId = resolveBaselineSprintFilter(
    savedPreference,
    suggestedDefaults
  );

  const resetProjectFilterToBaseline = useCallback(() => {
    setProjectFilterState(baselineProjectId);
    setSprintFilter(baselineSprintId);
  }, [baselineProjectId, baselineSprintId]);

  return {
    projectFilter,
    setProjectFilter,
    sprintFilter,
    setSprintFilter,
    savedDefaultsApplied,
    canClearDefaults,
    baselineProjectId,
    baselineSprintId,
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    openDefaultsDialog,
    handleSaveDefaults,
    handleSkipDefaults,
    handleClearDefaults,
    resetProjectFilterToBaseline,
  };
}
