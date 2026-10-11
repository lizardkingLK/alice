import { useEffect, useRef, useState } from 'react';
import { fetchProjectSprintsForForm } from '@/lib/form-read-actions';
import type { WorkItemSprintOption } from '@/app/work-items/_helpers/work-item-sprint';

export type UseProjectSprintsArgs = {
  readonly projectId: string;
  readonly providedSprints?: readonly WorkItemSprintOption[];
  readonly sprintId: string | null | undefined;
  /**
   * When true, skip network fetch and keep using `providedSprints`
   * (e.g. charts mock board).
   */
  readonly preferProvidedSprints?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onSprintChange: (sprintId: string | null) => void;
};

export function useProjectSprints({
  projectId,
  providedSprints = [],
  sprintId,
  preferProvidedSprints = false,
  onSprintChange,
}: UseProjectSprintsArgs) {
  const [sprints, setSprints] = useState<readonly WorkItemSprintOption[]>(
    () => {
      if (!projectId) {
        return providedSprints;
      }
      if (preferProvidedSprints) {
        return providedSprints;
      }
      if (sprintId) {
        const initial = providedSprints.find(
          (sprint) => sprint.id === sprintId
        );
        if (initial) {
          return [initial];
        }
      }
      return [];
    }
  );

  const sprintIdRef = useRef(sprintId);
  useEffect(() => {
    sprintIdRef.current = sprintId;
  }, [sprintId]);

  const onSprintChangeRef = useRef(onSprintChange);
  useEffect(() => {
    onSprintChangeRef.current = onSprintChange;
  }, [onSprintChange]);

  useEffect(() => {
    if (!preferProvidedSprints) {
      return;
    }
    setSprints(providedSprints);
    const latestSprintId = sprintIdRef.current;
    if (
      latestSprintId &&
      !providedSprints.some((sprint) => sprint.id === latestSprintId)
    ) {
      onSprintChangeRef.current(null);
    }
  }, [preferProvidedSprints, providedSprints]);

  useEffect(() => {
    if (preferProvidedSprints) {
      return;
    }

    let isMounted = true;

    if (!projectId) {
      setSprints([]);
      if (sprintIdRef.current) {
        onSprintChangeRef.current(null);
      }
      return () => {
        isMounted = false;
      };
    }

    fetchProjectSprintsForForm(projectId)
      .then((next) => {
        if (!isMounted) {
          return;
        }
        setSprints(next);
        const latestSprintId = sprintIdRef.current;
        if (
          latestSprintId &&
          !next.some((sprint) => sprint.id === latestSprintId)
        ) {
          onSprintChangeRef.current(null);
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setSprints([]);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, preferProvidedSprints]);

  return sprints;
}
