'use client';

import { useCallback, useEffect } from 'react';
import {
  ALL_PROJECTS_ID,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseChartsWorkspaceDefaultsOptions = {
  readonly userId: string | null;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly suggestedDefaults: BoardDefaultsPreference | null;
};

/**
 * Workspace defaults dialog for Charts (no URL rewrite).
 * Saved/suggested preference seeds filters when inserting a Chart widget.
 */
export function useChartsWorkspaceDefaults({
  userId,
  projects,
  sprints,
  suggestedDefaults,
}: UseChartsWorkspaceDefaultsOptions) {
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
  });

  useEffect(() => {
    const boot = consumeBootstrap();
    if (!boot) {
      return;
    }

    const { record, validated } = boot;
    if (!record?.prompted && !validated && suggestedDefaults) {
      promptDefaultsDialog(suggestedDefaults, true);
    }
  }, [consumeBootstrap, promptDefaultsDialog, suggestedDefaults]);

  const insertPreference = savedPreference ?? suggestedDefaults;

  const openDefaultsDialog = useCallback(() => {
    openSessionDefaultsDialog(
      insertPreference ?? {
        projectId: ALL_PROJECTS_ID,
        sprintId: null,
      }
    );
  }, [insertPreference, openSessionDefaultsDialog]);

  return {
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedPreference,
    insertPreference,
    savedDefaultsApplied: savedPreference !== null,
    canClearDefaults,
    openDefaultsDialog,
    handleSaveDefaults,
    handleSkipDefaults,
    handleClearDefaults,
  };
}
