'use client';

import { useEffect } from 'react';
import { useSoftInvalidateOptional } from '@/components/soft-invalidate/soft-invalidate-provider';

type UseSoftInvalidateProjectOptions = {
  /** When true and a form is not holding auto-refresh, workflow stale auto-calls router.refresh(). */
  readonly autoRefresh?: boolean;
};

/**
 * Register the open project for workflow soft-invalidation.
 * Clears the watch on unmount or when projectId becomes null.
 */
export function useSoftInvalidateProject(
  projectId: string | null | undefined,
  options?: UseSoftInvalidateProjectOptions
): void {
  const softInvalidate = useSoftInvalidateOptional();
  const autoRefresh = Boolean(options?.autoRefresh);
  const normalizedId = projectId?.trim() || null;

  useEffect(() => {
    if (!softInvalidate || !normalizedId) {
      return;
    }
    softInvalidate.addProjectWatch(normalizedId, autoRefresh);
    return () => {
      softInvalidate.removeProjectWatch(normalizedId, autoRefresh);
    };
  }, [softInvalidate, normalizedId, autoRefresh]);
}
