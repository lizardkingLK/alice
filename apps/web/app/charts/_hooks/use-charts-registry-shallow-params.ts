'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChartsRegistryListTab } from '@/lib/search-params';

export type { ChartsRegistryListTab } from '@/lib/search-params';

/* eslint-disable no-unused-vars -- callback param names in type positions */
type RegistryUrlMutator = (params: URLSearchParams) => void;

type ChartsRegistryUrlActions = {
  readonly setTab: (tab: ChartsRegistryListTab) => void;
  readonly setPage: (page: number) => void;
  readonly setLimit: (limit: number) => void;
  readonly replacePage: (page: number) => void;
};
/* eslint-enable no-unused-vars */

/**
 * URL updates for Charts registry filters via `router.push` / `replace`
 * (same pattern as Views).
 */
export function useChartsRegistryUrlActions(
  defaultLimit = 10
): ChartsRegistryUrlActions {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (mutate: RegistryUrlMutator, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  return {
    setTab: useCallback(
      (tab: ChartsRegistryListTab) => {
        navigate((params) => {
          if (tab === 'mine') {
            params.delete('tab');
          } else {
            params.set('tab', tab);
          }
          params.set('page', '1');
        });
      },
      [navigate]
    ),
    setPage: useCallback(
      (page: number) => {
        navigate((params) => {
          if (page <= 1) {
            params.delete('page');
          } else {
            params.set('page', String(page));
          }
        });
      },
      [navigate]
    ),
    replacePage: useCallback(
      (page: number) => {
        navigate((params) => {
          if (page <= 1) {
            params.delete('page');
          } else {
            params.set('page', String(page));
          }
        }, true);
      },
      [navigate]
    ),
    setLimit: useCallback(
      (limit: number) => {
        navigate((params) => {
          if (limit === defaultLimit) {
            params.delete('limit');
          } else {
            params.set('limit', String(limit));
          }
          params.set('page', '1');
        });
      },
      [defaultLimit, navigate]
    ),
  };
}
