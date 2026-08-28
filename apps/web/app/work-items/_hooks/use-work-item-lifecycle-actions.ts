'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import {
  archiveWorkItem,
  purgeWorkItem,
  restoreWorkItem,
} from '@/app/work-items/_services/work-items.mutations.client';
import { countWorkItemDescendants } from '@/app/work-items/_services/work-items.reads.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runRegistryLockedAction } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  workItemLifecycleConfirmCopy,
  type WorkItemLifecycleConfirmMode,
} from '@/app/work-items/_helpers/work-item-lifecycle-confirm';

/* eslint-disable no-unused-vars */
type UseWorkItemLifecycleActionsArgs = {
  readonly currentUserId?: string | null;
  readonly onError: (message: string | null) => void;
  /** Called after a successful restore, before `router.refresh()`. */
  readonly onRestoreSuccess?: (workItem: DbWorkItem) => void;
};

export function useWorkItemLifecycleActions({
  currentUserId,
  onError,
  onRestoreSuccess,
}: UseWorkItemLifecycleActionsArgs) {
  const router = useRouter();
  const { handleMutationError } = useOptimisticLock();
  const [isPending, startTransition] = useTransition();
  const [itemToConfirm, setItemToConfirm] = useState<DbWorkItem | null>(null);
  const [confirmMode, setConfirmMode] =
    useState<WorkItemLifecycleConfirmMode>('archive');
  const [confirmDescendantCount, setConfirmDescendantCount] = useState(0);

  const openLifecycleConfirm = useCallback(
    (workItem: DbWorkItem, mode: WorkItemLifecycleConfirmMode) => {
      setItemToConfirm(workItem);
      setConfirmMode(mode);
      setConfirmDescendantCount(0);
      onError(null);
      countWorkItemDescendants(workItem.id).then(
        setConfirmDescendantCount,
        () => setConfirmDescendantCount(0)
      );
    },
    [onError]
  );

  const runRestore = useCallback(
    async (workItem: DbWorkItem) => {
      const pendingFields: Record<string, unknown> = {
        record_status: 'active',
      };
      if (workItem.parent_id) {
        pendingFields.parent_id = null;
      }

      await runRegistryLockedAction({
        mutate: () => restoreWorkItem(workItem.id, workItem.updated_at),
        handleMutationError,
        entityType: 'work_item',
        entityId: workItem.id,
        expectedUpdatedAt: workItem.updated_at,
        pendingFields,
        currentUserId: currentUserId ?? undefined,
        failureFallback: 'Failed to restore work item.',
        onError,
        onSuccess: () => {
          onRestoreSuccess?.(workItem);
          router.refresh();
        },
      });
    },
    [currentUserId, handleMutationError, onError, onRestoreSuccess, router]
  );

  const handleArchiveRequest = useCallback(
    (workItem: DbWorkItem) => openLifecycleConfirm(workItem, 'archive'),
    [openLifecycleConfirm]
  );

  const handlePurgeRequest = useCallback(
    (workItem: DbWorkItem) => openLifecycleConfirm(workItem, 'purge'),
    [openLifecycleConfirm]
  );

  const handleRestore = useCallback(
    (workItem: DbWorkItem) => {
      onError(null);
      if (workItem.parent_id) {
        openLifecycleConfirm(workItem, 'restore');
        return;
      }
      startTransition(async () => {
        await runRestore(workItem);
      });
    },
    [onError, openLifecycleConfirm, runRestore]
  );

  const confirmLifecycleAction = useCallback(() => {
    if (!itemToConfirm) {
      return;
    }

    const target = itemToConfirm;
    const mode = confirmMode;

    startTransition(async () => {
      if (mode === 'restore') {
        await runRestore(target);
        setItemToConfirm(null);
        onError(null);
        return;
      }

      if (mode === 'archive') {
        const ok = await runRegistryLockedAction({
          mutate: () => archiveWorkItem(target.id, target.updated_at),
          handleMutationError,
          entityType: 'work_item',
          entityId: target.id,
          expectedUpdatedAt: target.updated_at,
          pendingFields: { record_status: 'archived' },
          currentUserId: currentUserId ?? undefined,
          failureFallback: 'Failed to archive work item.',
          onError,
        });
        if (!ok) {
          return;
        }
      } else {
        try {
          await purgeWorkItem(target.id);
        } catch (purgeError) {
          onError(
            purgeError instanceof Error
              ? purgeError.message
              : 'Failed to permanently delete work item.'
          );
          return;
        }
      }

      setItemToConfirm(null);
      onError(null);
      router.refresh();
    });
  }, [
    confirmMode,
    currentUserId,
    handleMutationError,
    itemToConfirm,
    onError,
    router,
    runRestore,
  ]);

  const confirmCopy = workItemLifecycleConfirmCopy(
    confirmMode,
    confirmDescendantCount,
    { hasParent: Boolean(itemToConfirm?.parent_id) }
  );

  return {
    isPending,
    itemToConfirm,
    confirmCopy,
    clearConfirm: () => setItemToConfirm(null),
    handleArchiveRequest,
    handlePurgeRequest,
    handleRestore,
    confirmLifecycleAction,
  };
}
