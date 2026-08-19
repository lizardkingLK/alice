'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  preferenceMatchesProjectFilter,
  preferenceToProjectFilter,
  projectFilterToPreference,
  resolveBaselineProjectFilter,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
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
  const [projectFilter, setProjectFilter] = useState('all');

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
    onSave: (preference) => {
      setProjectFilter(preferenceToProjectFilter(preference));
    },
  });

  useEffect(() => {
    const boot = consumeBootstrap();
    if (!boot) {
      return;
    }

    const { record, validated } = boot;

    if (validated) {
      setProjectFilter(preferenceToProjectFilter(validated));
    } else if (suggestedDefaults) {
      setProjectFilter(preferenceToProjectFilter(suggestedDefaults));
    }

    if (!record?.prompted && !validated && suggestedDefaults) {
      promptDefaultsDialog(suggestedDefaults, true);
    }
  }, [consumeBootstrap, promptDefaultsDialog, suggestedDefaults]);

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceMatchesProjectFilter(savedPreference, projectFilter);

  const openDefaultsDialog = useCallback(() => {
    openSessionDefaultsDialog(projectFilterToPreference(projectFilter));
  }, [openSessionDefaultsDialog, projectFilter]);

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
    canClearDefaults,
    baselineProjectId,
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
