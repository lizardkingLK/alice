'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  buildProjectSprintLookups,
  loadValidatedBoardDefaults,
  resolveOpenDefaultsPreference,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsDialog } from '@/app/board/_hooks/use-workspace-defaults-dialog';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseWorkspaceDefaultsSessionOptions = {
  readonly userId: string | null;
  readonly projects: readonly { readonly id: string }[];
  readonly sprints: readonly Sprint[];
  // eslint-disable-next-line no-unused-vars -- save callback signature
  readonly onSave?: (preference: BoardDefaultsPreference) => void;
};

/**
 * Shared lookups, dialog state, one-shot bootstrap load, and open/clear helpers
 * for board, backlog, and work-items defaults.
 */
export function useWorkspaceDefaultsSession({
  userId,
  projects,
  sprints,
  onSave,
}: UseWorkspaceDefaultsSessionOptions) {
  const didBootstrap = useRef(false);

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
    handleSaveDefaults,
    handleSkipDefaults,
    handleClearDefaults,
    promptDefaultsDialog,
    openDefaultsDialog: openDialog,
  } = useWorkspaceDefaultsDialog({
    userId,
    onSave,
  });

  const consumeBootstrap = useCallback(() => {
    if (!userId || didBootstrap.current) {
      return null;
    }
    didBootstrap.current = true;

    const result = loadValidatedBoardDefaults(userId, projectIds, sprintById);
    setSavedPreference(result.validated);
    return result;
  }, [projectIds, setSavedPreference, sprintById, userId]);

  const openDefaultsDialog = useCallback(
    (fallbackPreference: BoardDefaultsPreference) => {
      if (!userId) {
        return;
      }

      openDialog(
        resolveOpenDefaultsPreference(
          userId,
          projectIds,
          sprintById,
          fallbackPreference
        )
      );
    },
    [openDialog, projectIds, sprintById, userId]
  );

  return {
    projectIds,
    sprintById,
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedPreference,
    handleSaveDefaults,
    handleSkipDefaults,
    handleClearDefaults,
    promptDefaultsDialog,
    canClearDefaults: savedPreference !== null,
    consumeBootstrap,
    openDefaultsDialog,
  };
}
