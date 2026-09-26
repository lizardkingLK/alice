'use client';

import { useEffect } from 'react';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

type UseChartsWorkspaceDefaultsOptions = {
  readonly userId: string | null;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
};

/**
 * Workspace defaults for Charts (no URL rewrite).
 * Saved preference seeds filters when inserting a Chart widget.
 */
export function useChartsWorkspaceDefaults({
  userId,
  projects,
  sprints,
}: UseChartsWorkspaceDefaultsOptions) {
  const { savedPreference, saveDefaults, consumeBootstrap } =
    useWorkspaceDefaultsSession({
      userId,
      projects,
      sprints,
    });

  useEffect(() => {
    consumeBootstrap();
  }, [consumeBootstrap]);

  return {
    savedPreference,
    insertPreference: savedPreference as BoardDefaultsPreference | null,
    saveDefaults,
  };
}
