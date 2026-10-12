import { useCallback } from 'react';
import { fetchProjectSprintsForForm } from '@/lib/form-read-actions';
import type { WorkItemSprintOption } from '@/app/work-items/_helpers/work-item-sprint';
import { useProjectResourceOptions } from '@/app/work-items/_hooks/use-project-resource-options';

export type UseProjectSprintsArgs = {
  readonly projectId: string;
  readonly providedSprints?: readonly WorkItemSprintOption[];
  readonly sprintId: string | null | undefined;
  /**
   * When true, skip network fetch and keep using `providedSprints`
   * (e.g. charts mock board, dialog bootstrap).
   */
  readonly preferProvidedSprints?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onSprintChange: (sprintId: string | null) => void;
};

export type UseProjectSprintsResult = {
  readonly sprints: readonly WorkItemSprintOption[];
  readonly isLoading: boolean;
};

const EMPTY_SPRINTS: readonly WorkItemSprintOption[] = [];

export function useProjectSprints({
  projectId,
  providedSprints = EMPTY_SPRINTS,
  sprintId,
  preferProvidedSprints = false,
  onSprintChange,
}: UseProjectSprintsArgs): UseProjectSprintsResult {
  const fetchOptions = useCallback(
    (id: string) => fetchProjectSprintsForForm(id),
    []
  );

  const { options, isLoading } = useProjectResourceOptions({
    projectId,
    provided: providedSprints,
    selectedId: sprintId,
    preferProvided: preferProvidedSprints,
    clearWhenMissing: true,
    onSelectionChange: onSprintChange,
    fetchOptions,
    noProjectOptions: EMPTY_SPRINTS,
  });

  return { sprints: options, isLoading };
}
