'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const ALL_VALUE = 'all';

/**
 * Sync a single URL search param used as a list filter.
 * Writing `all` (or empty) removes the param and resets `page` to 1.
 */
export function useQueryFilter(paramKey: string, currentValue: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (nextValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!nextValue || nextValue === ALL_VALUE) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, nextValue);
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [paramKey, pathname, router, searchParams]
  );

  return {
    value: currentValue || ALL_VALUE,
    setFilter,
    allValue: ALL_VALUE,
  };
}
