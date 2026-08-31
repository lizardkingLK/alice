'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  OptimisticLockEntityType,
  OptimisticPendingPayload,
} from '@repo/types';
import { OptimisticLockConflictDialog } from '@/components/optimistic-lock/conflict-dialog';
import { OptimisticResolveListener } from '@/components/optimistic-lock/optimistic-resolve-listener';
import {
  clearOptimisticPending,
  writeOptimisticPending,
} from '@/lib/optimistic-lock/pending-storage';
import { isOptimisticLockClientError } from '@/lib/optimistic-lock/errors';
import { ApiError } from '@/lib/api/api-fetch.helper';

export type ConflictSession = {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly userId: string;
  readonly baseUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
  readonly serverEntity: Record<string, unknown>;
  readonly serverUpdatedAt: string;
};

/* eslint-disable no-unused-vars -- callback type params */
type OptimisticLockContextValue = {
  readonly openConflict: (session: ConflictSession) => void;
  readonly handleMutationError: (options: {
    readonly error: unknown;
    readonly entityType: OptimisticLockEntityType;
    readonly entityId: string;
    readonly userId: string;
    readonly baseUpdatedAt: string;
    readonly pendingFields: Record<string, unknown>;
  }) => boolean;
  readonly clearPending: (
    entityType: OptimisticLockEntityType,
    entityId: string,
    userId: string
  ) => void;
};
/* eslint-enable no-unused-vars */

const OptimisticLockContext = createContext<OptimisticLockContextValue | null>(
  null
);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function serverUpdatedAtFromEntity(entity: Record<string, unknown>): string {
  const value = entity.updated_at ?? entity.updatedAt;
  return typeof value === 'string' ? value : '';
}

export function OptimisticLockProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [session, setSession] = useState<ConflictSession | null>(null);

  const openConflict = useCallback((next: ConflictSession) => {
    writeOptimisticPending({
      entityType: next.entityType,
      entityId: next.entityId,
      userId: next.userId,
      baseUpdatedAt: next.baseUpdatedAt,
      pendingFields: next.pendingFields,
      savedAt: new Date().toISOString(),
    } satisfies OptimisticPendingPayload);
    setSession(next);
  }, []);

  const clearPending = useCallback(
    (
      entityType: OptimisticLockEntityType,
      entityId: string,
      userId: string
    ) => {
      clearOptimisticPending(entityType, entityId, userId);
    },
    []
  );

  const handleMutationError = useCallback(
    (options: {
      readonly error: unknown;
      readonly entityType: OptimisticLockEntityType;
      readonly entityId: string;
      readonly userId: string;
      readonly baseUpdatedAt: string;
      readonly pendingFields: Record<string, unknown>;
    }): boolean => {
      const { error } = options;
      let serverEntity: Record<string, unknown> | null = null;

      if (isOptimisticLockClientError(error)) {
        serverEntity = asRecord(error.serverEntity);
      } else if (error instanceof ApiError && error.status === 409) {
        if (error.serverEntity !== undefined) {
          serverEntity = asRecord(error.serverEntity);
        }
      }

      if (!serverEntity || Object.keys(serverEntity).length === 0) {
        return false;
      }

      const serverUpdatedAt = serverUpdatedAtFromEntity(serverEntity);
      if (!serverUpdatedAt) {
        return false;
      }

      openConflict({
        entityType: options.entityType,
        entityId: options.entityId,
        userId: options.userId,
        baseUpdatedAt: options.baseUpdatedAt,
        pendingFields: options.pendingFields,
        serverEntity,
        serverUpdatedAt,
      });
      return true;
    },
    [openConflict]
  );

  const value = useMemo(
    () => ({
      openConflict,
      handleMutationError,
      clearPending,
    }),
    [clearPending, handleMutationError, openConflict]
  );

  return (
    <OptimisticLockContext.Provider value={value}>
      {children}
      <OptimisticResolveListener />
      <OptimisticLockConflictDialog
        session={session}
        onResolved={() => setSession(null)}
      />
    </OptimisticLockContext.Provider>
  );
}

export function useOptimisticLock(): OptimisticLockContextValue {
  const context = useContext(OptimisticLockContext);
  if (!context) {
    throw new Error(
      'useOptimisticLock must be used within OptimisticLockProvider'
    );
  }
  return context;
}
