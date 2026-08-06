'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export const QUERY_FILTER_ALL_VALUE = 'all';

/** Normalize empty / "all" sentinels for list filter selects. */
export function normalizeQueryFilterValue(
  value: string,
  allValue: string = QUERY_FILTER_ALL_VALUE
): string {
  return !value || value === allValue ? allValue : value;
}

/** Write or clear a list-filter search param. */
export function applyQueryFilterParam(
  params: URLSearchParams,
  paramKey: string,
  nextValue: string,
  allValue: string = QUERY_FILTER_ALL_VALUE
): void {
  if (normalizeQueryFilterValue(nextValue, allValue) === allValue) {
    params.delete(paramKey);
  } else {
    params.set(paramKey, nextValue);
  }
}

/**
 * Sync a single URL search param used as a list filter.
 * Keeps optimistic local state so the select does not snap back while the
 * RSC refetch catches up. Writing `all` (or empty) removes the param and
 * resets `page` to 1.
 */
export function useQueryFilter(paramKey: string, currentValue: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serverValue = normalizeQueryFilterValue(currentValue);
  const [localValue, setLocalValue] = useState(serverValue);

  useEffect(() => {
    setLocalValue(serverValue);
  }, [serverValue]);

  const setValue = useCallback((nextValue: string) => {
    setLocalValue(normalizeQueryFilterValue(nextValue));
  }, []);

  const setFilter = useCallback(
    (nextValue: string) => {
      const normalized = normalizeQueryFilterValue(nextValue);
      setLocalValue(normalized);

      const params = new URLSearchParams(searchParams.toString());
      applyQueryFilterParam(params, paramKey, normalized);
      params.set('page', '1');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [paramKey, pathname, router, searchParams]
  );

  return {
    value: localValue,
    setFilter,
    setValue,
    allValue: QUERY_FILTER_ALL_VALUE,
  };
}
