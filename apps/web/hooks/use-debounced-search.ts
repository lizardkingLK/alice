'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function useDebouncedSearch(
  initialSearch: string,
  delay = 400,
  searchParamKey = 'search'
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    const currentSearch = searchParams.get(searchParamKey) ?? '';
    if (searchQuery === currentSearch) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchQuery) {
        params.set(searchParamKey, searchQuery);
      } else {
        params.delete(searchParamKey);
      }
      params.set('page', '1'); // reset page
      router.push(`${pathname}?${params.toString()}`);
    }, delay);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, pathname, router, searchParams, delay, searchParamKey]);

  return {
    searchQuery,
    setSearchQuery,
  };
}
