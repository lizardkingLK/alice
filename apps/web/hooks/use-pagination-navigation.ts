'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function usePaginationNavigation(totalPages: number, limit: number) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateToParams = useCallback((newPage: number, newLimit: number, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    params.set('limit', newLimit.toString());
    const url = `${pathname}?${params.toString()}`;
    if (replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  }, [searchParams, pathname, router]);

  const currentPage = Number.parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const lastValidPage = Math.max(1, totalPages);
    if (currentPage > lastValidPage) {
      navigateToParams(lastValidPage, limit, true);
    }
  }, [currentPage, totalPages, limit, navigateToParams]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      navigateToParams(newPage, limit);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    navigateToParams(1, newLimit);
  };

  return {
    handlePageChange,
    handleLimitChange,
    pathname,
    router,
    searchParams,
  };
}
