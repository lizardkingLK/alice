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

function normalizeUrl(url: string): string {
  if (url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url || '/';
}

type DashboardBreadcrumbRuntimeContextValue = {
  readonly segmentLabelsByUrl: Readonly<Record<string, string>>;
  readonly favoriteLabel: string | null;
  // eslint-disable-next-line no-unused-vars -- context setter
  readonly setSegmentLabel: (url: string, label: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- context setter
  readonly setFavoriteLabel: (label: string | null) => void;
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

  const value = useMemo(
    () => ({
      segmentLabelsByUrl,
      favoriteLabel,
      setSegmentLabel,
      setFavoriteLabel: commitFavoriteLabel,
    }),
    [commitFavoriteLabel, favoriteLabel, segmentLabelsByUrl, setSegmentLabel]
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
