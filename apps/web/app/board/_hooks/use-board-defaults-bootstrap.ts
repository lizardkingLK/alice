'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  clearBoardDefaults,
  readValidatedBoardDefaults,
  writeBoardDefaults,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import { buildBoardFilterRedirectPath } from '@/app/board/_services/board-defaults';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';

type SuggestedDefaults = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

type UseBoardDefaultsBootstrapOptions = {
  readonly userId: string | null;
  readonly allowAllFilters: boolean;
  readonly needsClientBootstrap: boolean;
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly suggestedDefaults: SuggestedDefaults | null;
};

function buildSprintLookup(sprints: readonly Sprint[]) {
  return new Map(
    sprints.map((sprint) => [
      sprint.id,
      { projectId: sprint.project?.id ?? null },
    ])
  );
}

/**
 * Seeds `/board` URL from localStorage (or suggested defaults) for
 * managers/members when no project query is present.
 */
export function useBoardDefaultsBootstrap({
  userId,
  allowAllFilters,
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
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [allowSkipInDialog, setAllowSkipInDialog] = useState(false);
  const [dialogInitialPreference, setDialogInitialPreference] =
    useState<BoardDefaultsPreference | null>(null);
  const [savedPreference, setSavedPreference] =
    useState<BoardDefaultsPreference | null>(null);

  const projectIds = useMemo(
    () => new Set(projects.map((project) => project.id)),
    [projects]
  );
  const sprintById = useMemo(() => buildSprintLookup(sprints), [sprints]);

  const navigateToPreference = useCallback(
    (preference: BoardDefaultsPreference) => {
      const path = buildBoardFilterRedirectPath({
        projectId: preference.projectId,
        sprintId: preference.sprintId ?? undefined,
      });
      if (path) {
        router.replace(path);
        return;
      }
      router.replace(pathname);
    },
    [pathname, router]
  );

  useEffect(() => {
    if (allowAllFilters || !userId) {
      return;
    }
    if (didBootstrap.current) {
      return;
    }
    didBootstrap.current = true;

    const { record, preference: validated } = readValidatedBoardDefaults(
      userId,
      projectIds,
      sprintById
    );

    if (record?.preference && !validated) {
      clearBoardDefaults(userId);
    }

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

    if (!record?.prompted && !validated) {
      setDialogInitialPreference(nextPreference);
      setAllowSkipInDialog(true);
      setDefaultsDialogOpen(true);
    }
  }, [
    allowAllFilters,
    navigateToPreference,
    needsClientBootstrap,
    projectIds,
    sprintById,
    suggestedDefaults,
    userId,
  ]);

  const openDefaultsDialog = useCallback(() => {
    if (!userId) {
      return;
    }

    const { preference: validated } = readValidatedBoardDefaults(
      userId,
      projectIds,
      sprintById
    );

    setDialogInitialPreference(
      validated ??
        (projectFilter
          ? {
              projectId: projectFilter,
              sprintId: sprintFilter || null,
            }
          : suggestedDefaults)
    );
    setAllowSkipInDialog(false);
    setDefaultsDialogOpen(true);
  }, [
    projectFilter,
    projectIds,
    sprintById,
    sprintFilter,
    suggestedDefaults,
    userId,
  ]);

  const handleSaveDefaults = useCallback(
    (preference: BoardDefaultsPreference) => {
      if (!userId) {
        return;
      }
      writeBoardDefaults(userId, {
        preference,
        prompted: true,
      });
      setSavedPreference(preference);
      setDefaultsDialogOpen(false);
      navigateToPreference(preference);
    },
    [navigateToPreference, userId]
  );

  const handleSkipDefaults = useCallback(() => {
    if (!userId) {
      return;
    }
    writeBoardDefaults(userId, {
      preference: null,
      prompted: true,
    });
    setSavedPreference(null);
    setDefaultsDialogOpen(false);
  }, [userId]);

  const handleDefaultsDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && allowSkipInDialog) {
        handleSkipDefaults();
        return;
      }
      setDefaultsDialogOpen(open);
    },
    [allowSkipInDialog, handleSkipDefaults]
  );

  const savedDefaultsApplied =
    savedPreference !== null &&
    savedPreference.projectId === projectFilter &&
    (savedPreference.sprintId ?? '') === sprintFilter;

  const baselinePreference = useMemo(() => {
    if (allowAllFilters) {
      return null;
    }
    return (
      savedPreference ??
      (suggestedDefaults
        ? {
            projectId: suggestedDefaults.projectId,
            sprintId: suggestedDefaults.sprintId,
          }
        : null)
    );
  }, [allowAllFilters, savedPreference, suggestedDefaults]);

  const urlFiltersActive = allowAllFilters
    ? Boolean(projectFilter || sprintFilter)
    : Boolean(
        baselinePreference &&
        (baselinePreference.projectId !== projectFilter ||
          (baselinePreference.sprintId ?? '') !== sprintFilter)
      );

  const resetUrlFilters = useCallback(() => {
    if (allowAllFilters) {
      router.replace(pathname);
      return;
    }
    if (baselinePreference) {
      navigateToPreference(baselinePreference);
      return;
    }
    router.replace(pathname);
  }, [
    allowAllFilters,
    baselinePreference,
    navigateToPreference,
    pathname,
    router,
  ]);

  return {
    defaultsDialogOpen,
    setDefaultsDialogOpen: handleDefaultsDialogOpenChange,
    allowSkipInDialog,
    dialogInitialPreference,
    savedDefaultsApplied,
    urlFiltersActive,
    openDefaultsDialog,
    handleSaveDefaults,
    handleSkipDefaults,
    resetUrlFilters,
  };
}
