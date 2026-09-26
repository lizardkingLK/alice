'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  writeBoardDefaults,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import {
  buildProjectSprintLookups,
  loadValidatedBoardDefaults,
} from '@/app/board/_helpers/workspace-defaults-shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseWorkspaceDefaultsSessionOptions = {
  readonly userId: string | null;
  readonly projects: readonly { readonly id: string }[];
  readonly sprints: readonly Sprint[];
  /**
   * Called after persistence (including clear → null). Use for URL / local
   * filter sync when saving outside the filter dialog apply path.
   */
  // eslint-disable-next-line no-unused-vars -- save callback signature
  readonly onSave?: (preference: BoardDefaultsPreference | null) => void;
};

/**
 * Shared lookups, one-shot bootstrap load, and save/clear for workspace
 * project/sprint defaults (no dialog — Filter dialog owns “Set as default”).
 */
export function useWorkspaceDefaultsSession({
  userId,
  projects,
  sprints,
  onSave,
}: UseWorkspaceDefaultsSessionOptions) {
  const didBootstrap = useRef(false);
  const [savedPreference, setSavedPreference] =
    useState<BoardDefaultsPreference | null>(null);

  const { projectIds, sprintById } = useMemo(
    () => buildProjectSprintLookups(projects, sprints),
    [projects, sprints]
  );

  const consumeBootstrap = useCallback(() => {
    if (!userId || didBootstrap.current) {
      return null;
    }
    didBootstrap.current = true;

    const result = loadValidatedBoardDefaults(userId, projectIds, sprintById);
    setSavedPreference(result.preference);
    return result;
  }, [projectIds, sprintById, userId]);

  const saveDefaults = useCallback(
    (preference: BoardDefaultsPreference | null) => {
      if (!userId) {
        return;
      }

      writeBoardDefaults(userId, preference);
      setSavedPreference(preference);
      onSave?.(preference);
    },
    [onSave, userId]
  );

  const clearDefaults = useCallback(() => {
    saveDefaults(null);
  }, [saveDefaults]);

  return {
    projectIds,
    sprintById,
    savedPreference,
    setSavedPreference,
    saveDefaults,
    clearDefaults,
    canClearDefaults: savedPreference !== null,
    consumeBootstrap,
  };
}
