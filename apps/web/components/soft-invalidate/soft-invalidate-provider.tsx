'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useScopedTableRealtime } from '@/lib/realtime/use-scoped-table-realtime';
import { createClient } from '@/lib/supabase/client';
import type { SoftInvalidateReason } from '@/lib/soft-invalidate/soft-invalidate-messages';
import {
  applyProjectWorkflowUpdate,
  type SoftInvalidateProjectBaseline,
  type SoftInvalidateProjectRow,
} from '@/lib/soft-invalidate/soft-invalidate-project-row';
import { workflowConfigStamp } from '@/lib/soft-invalidate/workflow-config-stamp';
import { SoftInvalidateBanner } from './soft-invalidate-banner';

type SoftInvalidateActions = {
  readonly addProjectWatch: (
    // eslint-disable-next-line no-unused-vars -- context API
    projectId: string,
    // eslint-disable-next-line no-unused-vars -- context API
    autoRefresh: boolean
  ) => void;
  readonly removeProjectWatch: (
    // eslint-disable-next-line no-unused-vars -- context API
    projectId: string,
    // eslint-disable-next-line no-unused-vars -- context API
    autoRefresh: boolean
  ) => void;
  /** While held, workflow stale never auto-refreshes (forms / dialogs). */
  // eslint-disable-next-line no-unused-vars -- context API
  readonly setAutoRefreshHold: (hold: boolean) => void;
  readonly dismiss: () => void;
  readonly refresh: () => void;
};

const SoftInvalidateActionsContext =
  createContext<SoftInvalidateActions | null>(null);

type SoftInvalidateProviderProps = {
  readonly userId: string | null;
  readonly initialRole: string | null;
  readonly children: ReactNode;
};

type UserRoleRow = {
  readonly id?: string;
  readonly role?: string;
};

type ProjectWatchEntry = {
  count: number;
  autoRefreshCount: number;
};

async function fetchProjectBaseline(
  projectId: string
): Promise<SoftInvalidateProjectBaseline | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('updated_at, workflow_config')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn(
        'warn. soft-invalidate failed to load project baseline:',
        error.message
      );
    }
    return null;
  }

  return {
    stamp: workflowConfigStamp(data.workflow_config),
    updatedAt: data.updated_at,
  };
}

async function fetchUserRole(userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn(
      'warn. soft-invalidate failed to load user role:',
      error.message
    );
    return null;
  }

  return typeof data?.role === 'string' ? data.role : null;
}

function reconcileWatches(watches: Map<string, ProjectWatchEntry>): {
  readonly projectId: string | null;
  readonly autoRefresh: boolean;
} {
  const ids = [...watches.keys()];
  const projectId = ids.at(-1) ?? null;
  if (!projectId) {
    return { projectId: null, autoRefresh: false };
  }
  const entry = watches.get(projectId);
  return {
    projectId,
    autoRefresh: (entry?.autoRefreshCount ?? 0) > 0,
  };
}

export function SoftInvalidateProvider({
  userId,
  initialRole,
  children,
}: SoftInvalidateProviderProps) {
  const router = useRouter();
  const [staleReason, setStaleReason] = useState<SoftInvalidateReason | null>(
    null
  );
  const [watchedProjectId, setWatchedProjectId] = useState<string | null>(null);
  const [autoRefreshRequested, setAutoRefreshRequested] = useState(false);
  const [autoRefreshHeld, setAutoRefreshHeld] = useState(false);

  const baselineRoleRef = useRef<string | null>(initialRole);
  const projectBaselineRef = useRef<SoftInvalidateProjectBaseline | null>(null);
  const watchesRef = useRef(new Map<string, ProjectWatchEntry>());
  const holdCountRef = useRef(0);
  const autoRefreshRequestedRef = useRef(false);
  const autoRefreshHeldRef = useRef(false);

  autoRefreshRequestedRef.current = autoRefreshRequested;
  autoRefreshHeldRef.current = autoRefreshHeld;

  useEffect(() => {
    baselineRoleRef.current = initialRole;
  }, [initialRole]);

  const dismiss = useCallback(() => {
    setStaleReason(null);
  }, []);

  const refresh = useCallback(() => {
    setStaleReason(null);
    router.refresh();
  }, [router]);

  const markWorkflowStale = useCallback(() => {
    if (autoRefreshRequestedRef.current && !autoRefreshHeldRef.current) {
      setStaleReason(null);
      router.refresh();
      return;
    }
    setStaleReason((current) => (current === 'role' ? current : 'workflow'));
  }, [router]);

  const markRoleStale = useCallback(() => {
    setStaleReason('role');
  }, []);

  const applyWatchReconcile = useCallback(() => {
    const next = reconcileWatches(watchesRef.current);
    setWatchedProjectId(next.projectId);
    setAutoRefreshRequested(next.autoRefresh);
    if (!next.projectId) {
      projectBaselineRef.current = null;
    }
  }, []);

  const addProjectWatch = useCallback(
    (projectId: string, autoRefresh: boolean) => {
      const id = projectId.trim();
      if (!id) {
        return;
      }
      const existing = watchesRef.current.get(id) ?? {
        count: 0,
        autoRefreshCount: 0,
      };
      existing.count += 1;
      if (autoRefresh) {
        existing.autoRefreshCount += 1;
      }
      watchesRef.current.set(id, existing);
      applyWatchReconcile();
    },
    [applyWatchReconcile]
  );

  const removeProjectWatch = useCallback(
    (projectId: string, autoRefresh: boolean) => {
      const id = projectId.trim();
      const existing = watchesRef.current.get(id);
      if (!existing) {
        return;
      }
      existing.count -= 1;
      if (autoRefresh) {
        existing.autoRefreshCount -= 1;
      }
      if (existing.count <= 0) {
        watchesRef.current.delete(id);
      } else {
        watchesRef.current.set(id, existing);
      }
      applyWatchReconcile();
    },
    [applyWatchReconcile]
  );

  const setAutoRefreshHold = useCallback((hold: boolean) => {
    if (hold) {
      holdCountRef.current += 1;
    } else {
      holdCountRef.current = Math.max(0, holdCountRef.current - 1);
    }
    setAutoRefreshHeld(holdCountRef.current > 0);
  }, []);

  useEffect(() => {
    if (!watchedProjectId) {
      projectBaselineRef.current = null;
      return;
    }

    let cancelled = false;
    fetchProjectBaseline(watchedProjectId)
      .then((baseline) => {
        if (!cancelled && baseline) {
          projectBaselineRef.current = baseline;
        }
      })
      .catch((error: unknown) => {
        console.warn(
          'warn. soft-invalidate project baseline fetch failed:',
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [watchedProjectId]);

  useScopedTableRealtime<UserRoleRow>({
    enabled: Boolean(userId),
    channelPrefix: 'soft-invalidate-role',
    table: 'users',
    filter: userId ? `id=eq.${userId}` : undefined,
    scopeKey: userId ?? '',
    events: ['UPDATE'],
    onChange: (payload) => {
      const nextRole = payload.new?.role;
      if (typeof nextRole !== 'string') {
        return;
      }
      if (nextRole === baselineRoleRef.current) {
        return;
      }
      baselineRoleRef.current = nextRole;
      markRoleStale();
    },
  });

  useScopedTableRealtime<SoftInvalidateProjectRow>({
    enabled: Boolean(watchedProjectId),
    channelPrefix: 'soft-invalidate-workflow',
    table: 'projects',
    filter: watchedProjectId ? `id=eq.${watchedProjectId}` : undefined,
    scopeKey: watchedProjectId ?? '',
    events: ['UPDATE'],
    onChange: (payload) => {
      const row = payload.new;
      const baseline = projectBaselineRef.current;
      if (!row || !baseline) {
        return;
      }
      const result = applyProjectWorkflowUpdate({
        row,
        baseline,
        viewerUserId: userId,
      });
      projectBaselineRef.current = result.nextBaseline;
      if (result.shouldInvalidate) {
        markWorkflowStale();
      }
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      fetchUserRole(userId)
        .then((role) => {
          if (role == null || role === baselineRoleRef.current) {
            return;
          }
          baselineRoleRef.current = role;
          markRoleStale();
        })
        .catch((error: unknown) => {
          console.warn('warn. soft-invalidate role focus check failed:', error);
        });

      const projectId = watchedProjectId;
      const baseline = projectBaselineRef.current;
      if (!projectId || !baseline) {
        return;
      }

      fetchProjectBaseline(projectId)
        .then((next) => {
          if (!next) {
            return;
          }
          if (next.stamp !== baseline.stamp) {
            projectBaselineRef.current = next;
            markWorkflowStale();
            return;
          }
          projectBaselineRef.current = next;
        })
        .catch((error: unknown) => {
          console.warn(
            'warn. soft-invalidate workflow focus check failed:',
            error
          );
        });
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, watchedProjectId, markRoleStale, markWorkflowStale]);

  const actions = useMemo<SoftInvalidateActions>(
    () => ({
      addProjectWatch,
      removeProjectWatch,
      setAutoRefreshHold,
      dismiss,
      refresh,
    }),
    [addProjectWatch, removeProjectWatch, setAutoRefreshHold, dismiss, refresh]
  );

  return (
    <SoftInvalidateActionsContext.Provider value={actions}>
      {staleReason ? (
        <SoftInvalidateBanner
          reason={staleReason}
          onRefresh={refresh}
          onDismiss={dismiss}
        />
      ) : null}
      {children}
    </SoftInvalidateActionsContext.Provider>
  );
}

/** Optional access when a surface may render outside the dashboard shell. */
export function useSoftInvalidateOptional(): SoftInvalidateActions | null {
  return useContext(SoftInvalidateActionsContext);
}
