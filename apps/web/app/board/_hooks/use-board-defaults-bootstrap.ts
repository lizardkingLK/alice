'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  buildProjectSprintLookups,
  loadValidatedBoardDefaults,
  preferenceMatchesBoardFilters,
  projectFilterToPreference,
  resolveOpenDefaultsPreference,
} from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsDialog } from '@/app/board/_hooks/use-workspace-defaults-dialog';
import { buildWorkspaceFilterRedirectPath } from '@/app/board/_services/board-defaults';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';

type SuggestedDefaults = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

type UseBoardDefaultsBootstrapOptions = {
  readonly userId: string | null;
  /** Path used when writing default project/sprint into the URL (e.g. `/board`). */
  readonly basePath?: string;
  readonly needsClientBootstrap: boolean;
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly suggestedDefaults: SuggestedDefaults | null;
};

/**
 * Seeds a workspace list/board URL from localStorage (or suggested defaults)
 * when no project query is present.
 */
export function useBoardDefaultsBootstrap({
  userId,
  basePath = '/board',
  needsClientBootstrap,
  projectFilter,
  sprintFilter,
  projects,
  sprints,
  suggestedDefaults,
}: UseBoardDefaultsBootstrapOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const didBootstrap = useRef(false);

  const { projectIds, sprintById } = useMemo(
    () => buildProjectSprintLookups(projects, sprints),
    [projects, sprints]
  );

  const navigateToPreference = useCallback(
    (preference: BoardDefaultsPreference) => {
      const path = buildWorkspaceFilterRedirectPath(basePath, {
        projectId: preference.projectId,
        sprintId: preference.sprintId ?? undefined,
      });
      if (path) {
        router.replace(path);
        return;
      }
      router.replace(pathname);
    },
    [basePath, pathname, router]
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
    onSave: navigateToPreference,
  });

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (didBootstrap.current) {
      return;
    }
    didBootstrap.current = true;

    const { record, validated } = loadValidatedBoardDefaults(
      userId,
      projectIds,
      sprintById
    );

    setSavedPreference(validated);

    if (!needsClientBootstrap) {
      return;
    }

    const nextPreference =
      validated ??
      (suggestedDefaults
        ? {
            projectId: suggestedDefaults.projectId,
            sprintId: suggestedDefaults.sprintId,
          }
        : null);

    if (nextPreference) {
      navigateToPreference(nextPreference);
    }

    if (!record?.prompted && !validated && suggestedDefaults) {
      promptDefaultsDialog(nextPreference, true);
    }
  }, [
    navigateToPreference,
    needsClientBootstrap,
    projectIds,
    promptDefaultsDialog,
    setSavedPreference,
    sprintById,
    suggestedDefaults,
    userId,
  ]);

  const openDefaultsDialog = useCallback(() => {
    if (!userId) {
      return;
    }

    openDialog(
      resolveOpenDefaultsPreference(
        userId,
        projectIds,
        sprintById,
        projectFilterToPreference(projectFilter || 'all', sprintFilter)
      )
    );
  }, [openDialog, projectFilter, projectIds, sprintById, sprintFilter, userId]);

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceMatchesBoardFilters(savedPreference, projectFilter, sprintFilter);

  const baselinePreference = useMemo(() => {
    return (
      savedPreference ??
      (suggestedDefaults
        ? {
            projectId: suggestedDefaults.projectId,
            sprintId: suggestedDefaults.sprintId,
          }
        : null)
    );
  }, [savedPreference, suggestedDefaults]);

  const urlFiltersActive = baselinePreference
    ? !preferenceMatchesBoardFilters(
        baselinePreference,
        projectFilter,
        sprintFilter
      )
    : Boolean(projectFilter || sprintFilter);

  const resetUrlFilters = useCallback(() => {
    if (baselinePreference) {
      navigateToPreference(baselinePreference);
      return;
    }
    router.replace(pathname);
  }, [baselinePreference, navigateToPreference, pathname, router]);

  return {
    defaultsDialogOpen,
    setDefaultsDialogOpen,
    allowSkipInDialog,
    dialogInitialPreference,
    savedDefaultsApplied,
    urlFiltersActive,
    openDefaultsDialog,
    handleSaveDefaults: saveDefaults,
    handleSkipDefaults,
    resetUrlFilters,
  };
}
