'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  buildProjectSprintLookups,
  loadValidatedBoardDefaults,
  preferenceMatchesProjectFilter,
  preferenceToProjectFilter,
  projectFilterToPreference,
  resolveBaselineProjectFilter,
  resolveOpenDefaultsPreference,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsDialog } from '@/app/board/_hooks/use-workspace-defaults-dialog';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { Sprint } from '@/app/sprints/_services/sprints.service';

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
  const didBootstrap = useRef(false);
  const [projectFilter, setProjectFilter] = useState('all');

  const { projectIds, sprintById } = useMemo(
    () => buildProjectSprintLookups(projects, sprints),
    [projects, sprints]
  );

  const {
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedPreference,
    setSavedPreference,
    handleSaveDefaults: saveDefaults,
    handleSkipDefaults,
    promptDefaultsDialog,
    openDefaultsDialog: openDialog,
  } = useWorkspaceDefaultsDialog({
    userId,
    onSave: (preference) => {
      setProjectFilter(preferenceToProjectFilter(preference));
    },
  });

  useEffect(() => {
    if (!userId || didBootstrap.current) {
      return;
    }
    didBootstrap.current = true;

    const { record, validated } = loadValidatedBoardDefaults(
      userId,
      projectIds,
      sprintById
    );

    setSavedPreference(validated);

    if (validated) {
      setProjectFilter(preferenceToProjectFilter(validated));
    } else if (suggestedDefaults) {
      setProjectFilter(preferenceToProjectFilter(suggestedDefaults));
    }

    if (!record?.prompted && !validated && suggestedDefaults) {
      promptDefaultsDialog(suggestedDefaults, true);
    }
  }, [
    projectIds,
    promptDefaultsDialog,
    setSavedPreference,
    sprintById,
    suggestedDefaults,
    userId,
  ]);

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceMatchesProjectFilter(savedPreference, projectFilter);

  const openDefaultsDialog = useCallback(() => {
    if (!userId) {
      return;
    }

    openDialog(
      resolveOpenDefaultsPreference(
        userId,
        projectIds,
        sprintById,
        projectFilterToPreference(projectFilter)
      )
    );
  }, [openDialog, projectFilter, projectIds, sprintById, userId]);

  const baselineProjectId = resolveBaselineProjectFilter(
    savedPreference,
    suggestedDefaults
  );

  const resetProjectFilterToBaseline = useCallback(() => {
    setProjectFilter(baselineProjectId);
  }, [baselineProjectId]);

  return {
    projectFilter,
    setProjectFilter,
    savedDefaultsApplied,
    baselineProjectId,
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    openDefaultsDialog,
    handleSaveDefaults: saveDefaults,
    handleSkipDefaults,
    resetProjectFilterToBaseline,
  };
}
