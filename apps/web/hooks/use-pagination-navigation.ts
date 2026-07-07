'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function usePaginationNavigation(totalPages: number, limit: number) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateToParams = (newPage: number, newLimit: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    params.set('limit', newLimit.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

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
