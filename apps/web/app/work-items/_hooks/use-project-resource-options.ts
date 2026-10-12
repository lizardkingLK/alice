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

function initialOptions<T extends { readonly id: string }>(args: {
  readonly projectId: string;
  readonly provided: readonly T[];
  readonly selectedId: string | null | undefined;
  readonly preferProvided: boolean;
  readonly noProjectOptions: readonly T[];
}): readonly T[] {
  const { projectId, provided, selectedId, preferProvided, noProjectOptions } =
    args;
  if (!projectId) {
    return noProjectOptions;
  }
  if (preferProvided) {
    return provided;
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
 * seed-while-fetch, and clear-selection-when-missing.
 */
export function useProjectResourceOptions<T extends { readonly id: string }>({
  projectId,
  provided,
  selectedId,
  preferProvided = false,
  clearWhenMissing = true,
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
    })
  );
  const [isLoading, setIsLoading] = useState(
    () => Boolean(projectId) && !preferProvided
  );

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

    setIsLoading(true);
    fetchOptionsRef
      .current(projectId)
      .then((next) => {
        if (!isMounted) {
          return;
        }
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
  }, [projectId, preferProvided, clearWhenMissing]);

  return { options, isLoading };
}
