'use client';

import { useEffect, useState } from 'react';
import { isSessionExpiredError } from '@/lib/errors/session-expired';

/** Fired after {@link invalidateChartAnalyticsCaches} so open hooks refetch. */
export const CHART_ANALYTICS_INVALIDATE_EVENT =
  'alice:chart-analytics-invalidate';

type ClearableCache = { clear: () => void };

const registeredCaches: ClearableCache[] = [];

/** Register an in-memory response cache cleared by invalidate. */
export function registerChartAnalyticsCache(cache: ClearableCache): void {
  if (!registeredCaches.includes(cache)) {
    registeredCaches.push(cache);
  }
}

/** Clear all registered chart analytics caches and notify open hooks. */
export function invalidateChartAnalyticsCaches(): void {
  for (const cache of registeredCaches) {
    cache.clear();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHART_ANALYTICS_INVALIDATE_EVENT));
  }
}

/**
 * Bumps when {@link CHART_ANALYTICS_INVALIDATE_EVENT} fires.
 * Optional `externalEpoch` lets callers force a refetch without the event.
 */
export function useChartAnalyticsInvalidateEpoch(
  externalEpoch = 0
): number {
  const [invalidateEpoch, setInvalidateEpoch] = useState(0);

  useEffect(() => {
    const onInvalidate = () => {
      setInvalidateEpoch((value) => value + 1);
    };
    window.addEventListener(CHART_ANALYTICS_INVALIDATE_EVENT, onInvalidate);
    return () => {
      window.removeEventListener(
        CHART_ANALYTICS_INVALIDATE_EVENT,
        onInvalidate
      );
    };
  }, []);

  return externalEpoch + invalidateEpoch;
}

type CachedAnalyticsResourceState<T> = {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
};

const IDLE_RESOURCE: CachedAnalyticsResourceState<never> = {
  data: null,
  loading: false,
  error: null,
};

/**
 * Cached GET for chart series/drilldown. Shares invalidate epoch + Map cache.
 * `keepPreviousOnDisable` preserves last data when the effect turns off
 * (flat chart drilldown); otherwise data clears (hierarchy drilldown).
 */
export function useCachedAnalyticsResource<T>(options: {
  readonly enabled: boolean;
  readonly cache: Map<string, T>;
  readonly cacheKey: string;
  readonly epoch: number;
  readonly fetcher: () => Promise<T>;
  readonly fallbackError: string;
  readonly keepPreviousOnDisable?: boolean;
}): CachedAnalyticsResourceState<T> {
  const {
    enabled,
    cache,
    cacheKey,
    epoch,
    fetcher,
    fallbackError,
    keepPreviousOnDisable = false,
  } = options;

  const [state, setState] =
    useState<CachedAnalyticsResourceState<T>>(IDLE_RESOURCE);

  useEffect(() => {
    if (!enabled) {
      setState((prev) =>
        keepPreviousOnDisable
          ? { ...prev, loading: false, error: null }
          : IDLE_RESOURCE
      );
      return;
    }

    const cached = cache.get(cacheKey);
    if (cached) {
      setState({
        data: cached,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    fetcher()
      .then((data) => {
        cache.set(cacheKey, data);
        if (cancelled) {
          return;
        }
        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // Session expiry opens the shared dialog via apiFetch; skip inline error.
        if (isSessionExpiredError(error)) {
          setState((prev) => ({
            ...prev,
            loading: false,
          }));
          return;
        }
        setState({
          data: null,
          loading: false,
          error:
            error instanceof Error ? error.message : fallbackError,
        });
      });

    return () => {
      cancelled = true;
    };
    // fetcher identity is intentionally omitted; callers pass stable deps via cacheKey/epoch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheKey + epoch gate refetch
  }, [
    cache,
    cacheKey,
    enabled,
    epoch,
    fallbackError,
    keepPreviousOnDisable,
  ]);

  return state;
}
