import { useEffect, useRef, useState } from 'react';

export type UseProjectResourceOptionsArgs<T extends { readonly id: string }> = {
  readonly projectId: string;
  readonly provided: readonly T[];
  readonly selectedId: string | null | undefined;
  readonly preferProvided?: boolean;
  /**
   * When true, clear `selectedId` if it is missing from the loaded options
   * (e.g. always for sprints; only when assignee is not locked).
   */
  readonly clearWhenMissing?: boolean;
  /**
   * Module-level cache scope (e.g. `members`, `sprints`) so remounts /
   * layout switches reuse the last successful fetch for a project id.
   */
  readonly cacheScope?: string;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectionChange: (selectedId: string | null) => void;
  // eslint-disable-next-line no-unused-vars
  readonly fetchOptions: (projectId: string) => Promise<readonly T[]>;
  /** Options used when `projectId` is empty (members keep provided; sprints clear). */
  readonly noProjectOptions?: readonly T[];
};

export type UseProjectResourceOptionsResult<T extends { readonly id: string }> =
  {
    readonly options: readonly T[];
    readonly isLoading: boolean;
  };

/** Survives form remounts within the same browser session. */
const projectResourceCache = new Map<
  string,
  readonly { readonly id: string }[]
>();

function cacheKey(scope: string, projectId: string): string {
  return `${scope}:${projectId}`;
}

function readCache<T extends { readonly id: string }>(
  scope: string | undefined,
  projectId: string
): readonly T[] | null {
  if (!scope || !projectId) {
    return null;
  }
  const hit = projectResourceCache.get(cacheKey(scope, projectId));
  return hit ? (hit as readonly T[]) : null;
}

function writeCache<T extends { readonly id: string }>(
  scope: string | undefined,
  projectId: string,
  options: readonly T[]
): void {
  if (!scope || !projectId) {
    return;
  }
  projectResourceCache.set(cacheKey(scope, projectId), options);
}

function initialOptions<T extends { readonly id: string }>(args: {
  readonly projectId: string;
  readonly provided: readonly T[];
  readonly selectedId: string | null | undefined;
  readonly preferProvided: boolean;
  readonly noProjectOptions: readonly T[];
  readonly cacheScope?: string;
}): readonly T[] {
  const {
    projectId,
    provided,
    selectedId,
    preferProvided,
    noProjectOptions,
    cacheScope,
  } = args;
  if (!projectId) {
    return noProjectOptions;
  }
  if (preferProvided) {
    return provided;
  }
  const cached = readCache<T>(cacheScope, projectId);
  if (cached) {
    return cached;
  }
  if (selectedId) {
    const initial = provided.find((item) => item.id === selectedId);
    if (initial) {
      return [initial];
    }
  }
  if (provided.length > 0) {
    return provided;
  }
  return [];
}

function clearIfMissing(
  selectedId: string | null | undefined,
  options: readonly { readonly id: string }[],
  clearWhenMissing: boolean,
  // eslint-disable-next-line no-unused-vars
  onSelectionChange: (selectedId: string | null) => void
): void {
  if (
    clearWhenMissing &&
    selectedId &&
    !options.some((item) => item.id === selectedId)
  ) {
    onSelectionChange(null);
  }
}

/**
 * Shared project-scoped option loader (members, sprints, …): prefer-provided,
 * seed-while-fetch, session cache, and clear-selection-when-missing.
 */
export function useProjectResourceOptions<T extends { readonly id: string }>({
  projectId,
  provided,
  selectedId,
  preferProvided = false,
  clearWhenMissing = true,
  cacheScope,
  onSelectionChange,
  fetchOptions,
  noProjectOptions = [],
}: UseProjectResourceOptionsArgs<T>): UseProjectResourceOptionsResult<T> {
  const [options, setOptions] = useState<readonly T[]>(() =>
    initialOptions({
      projectId,
      provided,
      selectedId,
      preferProvided,
      noProjectOptions,
      cacheScope,
    })
  );
  const [isLoading, setIsLoading] = useState(() => {
    if (!projectId || preferProvided) {
      return false;
    }
    return readCache(cacheScope, projectId) == null;
  });

  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const noProjectOptionsRef = useRef(noProjectOptions);
  useEffect(() => {
    noProjectOptionsRef.current = noProjectOptions;
  }, [noProjectOptions]);

  const fetchOptionsRef = useRef(fetchOptions);
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
  }, [fetchOptions]);

  useEffect(() => {
    if (!preferProvided) {
      return;
    }
    setOptions(provided);
    setIsLoading(false);
    clearIfMissing(
      selectedIdRef.current,
      provided,
      clearWhenMissing,
      onSelectionChangeRef.current
    );
  }, [preferProvided, provided, clearWhenMissing]);

  useEffect(() => {
    if (preferProvided) {
      return;
    }

    let isMounted = true;

    if (!projectId) {
      const fallback = noProjectOptionsRef.current;
      setOptions(fallback);
      setIsLoading(false);
      clearIfMissing(
        selectedIdRef.current,
        fallback,
        clearWhenMissing,
        onSelectionChangeRef.current
      );
      return () => {
        isMounted = false;
      };
    }

    const cached = readCache<T>(cacheScope, projectId);
    if (cached) {
      setOptions(cached);
      setIsLoading(false);
      clearIfMissing(
        selectedIdRef.current,
        cached,
        clearWhenMissing,
        onSelectionChangeRef.current
      );
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    fetchOptionsRef
      .current(projectId)
      .then((next) => {
        if (!isMounted) {
          return;
        }
        writeCache(cacheScope, projectId, next);
        setOptions(next);
        setIsLoading(false);
        clearIfMissing(
          selectedIdRef.current,
          next,
          clearWhenMissing,
          onSelectionChangeRef.current
        );
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setOptions([]);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, preferProvided, clearWhenMissing, cacheScope]);

  return { options, isLoading };
}
