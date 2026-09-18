'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';

function normalizeUrl(url: string): string {
  if (url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url || '/';
}

function trailsEqual(
  prev: readonly DashboardBreadcrumbOverride[] | null,
  trail: readonly DashboardBreadcrumbOverride[]
): boolean {
  return (
    prev?.length === trail.length &&
    (prev?.every(
      (item, index) =>
        item.url === trail[index]?.url && item.label === trail[index]?.label
    ) ??
      false)
  );
}

type DashboardBreadcrumbRuntimeContextValue = {
  readonly segmentLabelsByUrl: Readonly<Record<string, string>>;
  readonly favoriteLabel: string | null;
  /**
   * When false, the header favorite control stays disabled (e.g. chat still
   * hydrating / URL not yet aligned with the active conversation).
   */
  readonly favoritesReady: boolean;
  /** When set, replaces path-derived crumbs (e.g. Chat + conversation title). */
  readonly trailOverride: readonly DashboardBreadcrumbOverride[] | null;
  // eslint-disable-next-line no-unused-vars -- context setter
  readonly setSegmentLabel: (url: string, label: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- context setter
  readonly setFavoriteLabel: (label: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- context setter
  readonly setFavoritesReady: (ready: boolean) => void;
  readonly setTrailOverride: (
    // eslint-disable-next-line no-unused-vars -- context setter
    trail: readonly DashboardBreadcrumbOverride[] | null
  ) => void;
};

const DashboardBreadcrumbRuntimeContext =
  createContext<DashboardBreadcrumbRuntimeContextValue | null>(null);

export function DashboardBreadcrumbRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [segmentLabelsByUrl, setSegmentLabelsByUrl] = useState<
    Record<string, string>
  >({});
  const [favoriteLabel, setFavoriteLabel] = useState<string | null>(null);
  const [favoritesReady, setFavoritesReady] = useState(true);
  const [trailOverride, setTrailOverride] = useState<
    readonly DashboardBreadcrumbOverride[] | null
  >(null);

  const setSegmentLabel = useCallback((url: string, label: string | null) => {
    const key = normalizeUrl(url);
    setSegmentLabelsByUrl((prev) => {
      if (label == null || label.trim() === '') {
        if (!(key in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === label) {
        return prev;
      }
      return { ...prev, [key]: label };
    });
  }, []);

  const commitFavoriteLabel = useCallback((label: string | null) => {
    const next = label?.trim() ? label.trim() : null;
    setFavoriteLabel((prev) => (prev === next ? prev : next));
  }, []);

  const commitFavoritesReady = useCallback((ready: boolean) => {
    setFavoritesReady((prev) => (prev === ready ? prev : ready));
  }, []);

  const commitTrailOverride = useCallback(
    (trail: readonly DashboardBreadcrumbOverride[] | null) => {
      setTrailOverride((prev) => {
        if (trail == null) {
          return prev == null ? prev : null;
        }
        return trailsEqual(prev, trail) ? prev : trail;
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      segmentLabelsByUrl,
      favoriteLabel,
      favoritesReady,
      trailOverride,
      setSegmentLabel,
      setFavoriteLabel: commitFavoriteLabel,
      setFavoritesReady: commitFavoritesReady,
      setTrailOverride: commitTrailOverride,
    }),
    [
      commitFavoriteLabel,
      commitFavoritesReady,
      commitTrailOverride,
      favoriteLabel,
      favoritesReady,
      segmentLabelsByUrl,
      setSegmentLabel,
      trailOverride,
    ]
  );

  return (
    <DashboardBreadcrumbRuntimeContext.Provider value={value}>
      {children}
    </DashboardBreadcrumbRuntimeContext.Provider>
  );
}

export function useDashboardBreadcrumbRuntime() {
  return useContext(DashboardBreadcrumbRuntimeContext);
}

/**
 * Client pages (e.g. charts workspaces) can replace a path UUID crumb and the
 * favorite star label once the entity title is known.
 */
export function useDashboardEntityBreadcrumb(params: {
  readonly url: string;
  readonly label: string | null | undefined;
  readonly favoriteLabel?: string | null;
}) {
  const runtime = useDashboardBreadcrumbRuntime();
  const setSegmentLabel = runtime?.setSegmentLabel;
  const setFavoriteLabel = runtime?.setFavoriteLabel;
  const { url, label, favoriteLabel } = params;

  useEffect(() => {
    if (!setSegmentLabel) {
      return;
    }
    setSegmentLabel(url, label ?? null);
    return () => {
      setSegmentLabel(url, null);
    };
  }, [label, setSegmentLabel, url]);

  useEffect(() => {
    if (!setFavoriteLabel) {
      return;
    }
    setFavoriteLabel(favoriteLabel ?? label ?? null);
    return () => {
      setFavoriteLabel(null);
    };
  }, [favoriteLabel, label, setFavoriteLabel]);
}

/**
 * Client pages whose entity is query-scoped (e.g. `/chat?conversationId=`) can
 * replace the full header trail once the title is known.
 */
export function useDashboardTrailBreadcrumb(
  trail: readonly DashboardBreadcrumbOverride[] | null,
  options?: Readonly<{ favoritesReady?: boolean }>
) {
  const runtime = useDashboardBreadcrumbRuntime();
  const setTrailOverride = runtime?.setTrailOverride;
  const setFavoriteLabel = runtime?.setFavoriteLabel;
  const setFavoritesReady = runtime?.setFavoritesReady;
  const favoritesReady = options?.favoritesReady ?? true;

  useEffect(() => {
    if (!setTrailOverride) {
      return;
    }
    setTrailOverride(trail);
    return () => {
      setTrailOverride(null);
    };
  }, [setTrailOverride, trail]);

  useEffect(() => {
    if (!setFavoriteLabel) {
      return;
    }
    if (!trail?.length) {
      setFavoriteLabel(null);
      return;
    }
    const last = trail.at(-1)?.label ?? null;
    setFavoriteLabel(last);
    return () => {
      setFavoriteLabel(null);
    };
  }, [setFavoriteLabel, trail]);

  useEffect(() => {
    if (!setFavoritesReady) {
      return;
    }
    setFavoritesReady(favoritesReady);
    return () => {
      setFavoritesReady(true);
    };
  }, [favoritesReady, setFavoritesReady]);
}

export function applyRuntimeBreadcrumbLabels<
  T extends { readonly url: string; readonly label: string },
>(
  items: readonly T[],
  segmentLabelsByUrl: Readonly<Record<string, string>> | undefined
): T[] {
  if (!segmentLabelsByUrl || Object.keys(segmentLabelsByUrl).length === 0) {
    return [...items];
  }
  return items.map((item) => {
    const override = segmentLabelsByUrl[normalizeUrl(item.url)];
    return override ? { ...item, label: override } : item;
  });
}
