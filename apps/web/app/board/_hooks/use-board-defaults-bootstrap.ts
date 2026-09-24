'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ALL_PROJECTS_ID,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import { preferenceMatchesBoardFilters } from '@/app/board/_helpers/workspace-defaults-shared';
import { useWorkspaceDefaultsSession } from '@/app/board/_hooks/use-workspace-defaults-session';
import { buildWorkspaceFilterRedirectPath } from '@/app/board/_services/board.defaults.shared';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { parseBoardPageTab } from '@/lib/search-params';

type UseBoardDefaultsBootstrapOptions = {
  readonly userId: string | null;
  /** Path used when writing default project/sprint into the URL (e.g. `/board`). */
  readonly basePath?: string;
  readonly needsClientBootstrap: boolean;
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
};

/**
 * Seeds a workspace list/board URL from localStorage when no project query is
 * present. Missing storage → All projects / All sprints (`project=all`).
 */
export function useBoardDefaultsBootstrap({
  userId,
  basePath = '/board',
  needsClientBootstrap,
  projectFilter,
  sprintFilter,
  projects,
  sprints,
}: UseBoardDefaultsBootstrapOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateToPreference = useCallback(
    (preference: BoardDefaultsPreference | null) => {
      const tab = parseBoardPageTab(searchParams.get('tab'));
      const path = buildWorkspaceFilterRedirectPath(basePath, {
        projectId: preference?.projectId ?? ALL_PROJECTS_ID,
        sprintId: preference?.sprintId ?? undefined,
        tab: tab === 'board' ? undefined : tab,
      });
      if (path) {
        router.replace(path);
        return;
      }
      router.replace(pathname);
    },
    [basePath, pathname, router, searchParams]
  );

  const { savedPreference, saveDefaults, consumeBootstrap } =
    useWorkspaceDefaultsSession({
      userId,
      projects,
      sprints,
    });

  useEffect(() => {
    const boot = consumeBootstrap();
    if (!boot || !needsClientBootstrap) {
      return;
    }

    navigateToPreference(boot.preference);
  }, [consumeBootstrap, navigateToPreference, needsClientBootstrap]);

  const savedDefaultsApplied =
    savedPreference !== null &&
    preferenceMatchesBoardFilters(savedPreference, projectFilter, sprintFilter);

  const urlFiltersActive = useMemo(() => {
    if (savedPreference) {
      return !preferenceMatchesBoardFilters(
        savedPreference,
        projectFilter,
        sprintFilter
      );
    }
    return Boolean((projectFilter && projectFilter !== 'all') || sprintFilter);
  }, [projectFilter, savedPreference, sprintFilter]);

  const resetUrlFilters = useCallback(() => {
    navigateToPreference(savedPreference);
  }, [navigateToPreference, savedPreference]);

  return {
    savedPreference,
    savedDefaultsApplied,
    urlFiltersActive,
    saveDefaults,
    resetUrlFilters,
  };
}
