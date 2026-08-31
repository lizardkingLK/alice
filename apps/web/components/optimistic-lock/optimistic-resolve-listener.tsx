'use client';

import { useEffect } from 'react';
import { toast } from '@repo/ui/components/ui/sonner';
import { forceUpdateComment } from '@/app/comments/_services/comments.mutations.client';
import { forceUpdateProject } from '@/app/projects/_services/projects.mutations.client';
import {
  forceUpdateSprint,
  forceUpdateSprintStatus,
} from '@/app/sprints/_services/sprints.mutations.client';
import { forceUpdateTeam } from '@/app/manager/_services/teams.mutations.client';
import { forceUpdateUser } from '@/app/users/_services/users.mutations.client';
import { forceUpdateAccessAllowlistEntry } from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import { forceUpdateWorkItemFields } from '@/app/work-items/_services/work-items.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { clearOptimisticPending } from '@/lib/optimistic-lock/pending-storage';
import type { OptimisticLockEntityType } from '@repo/types';

type ResolveDetail = {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly userId: string;
  readonly expectedUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
  readonly mode: 'keep-mine' | 'merge';
};

async function applyOptimisticResolution(detail: ResolveDetail): Promise<void> {
  const { entityType, entityId, expectedUpdatedAt, pendingFields } = detail;

  switch (entityType) {
    case 'work_item':
      await forceUpdateWorkItemFields(
        entityId,
        pendingFields,
        expectedUpdatedAt
      );
      break;
    case 'comment':
      await forceUpdateComment(entityId, pendingFields, expectedUpdatedAt);
      break;
    case 'project':
      await forceUpdateProject(entityId, pendingFields, expectedUpdatedAt);
      break;
    case 'sprint':
      if (
        pendingFields.status !== undefined &&
        Object.keys(pendingFields).length === 1
      ) {
        await forceUpdateSprintStatus(
          entityId,
          pendingFields,
          expectedUpdatedAt
        );
      } else {
        await forceUpdateSprint(entityId, pendingFields, expectedUpdatedAt);
      }
      break;
    case 'team':
      await forceUpdateTeam(entityId, pendingFields, expectedUpdatedAt);
      break;
    case 'user':
      if (
        pendingFields.name !== undefined ||
        pendingFields.role !== undefined
      ) {
        await forceUpdateUser(entityId, pendingFields, expectedUpdatedAt);
      } else if (pendingFields.profile_picture !== undefined) {
        throw new Error(
          'Profile picture conflicts must be resolved by uploading again.'
        );
      } else {
        await apiFetch(`/api/profile`, {
          method: 'PATCH',
          body: JSON.stringify({ ...pendingFields, expectedUpdatedAt }),
        });
      }
      break;
    case 'access_allowlist':
      await forceUpdateAccessAllowlistEntry(
        entityId,
        pendingFields,
        expectedUpdatedAt
      );
      break;
    default:
      throw new Error(`Unsupported optimistic-lock entity: ${entityType}`);
  }
}

/**
 * Listens for conflict-dialog resolution events and re-applies pending fields
 * using the server's current updated timestamp as the new optimistic base.
 */
export function OptimisticResolveListener() {
  useEffect(() => {
    const onResolve = (event: Event) => {
      const detail = (event as CustomEvent<ResolveDetail>).detail;
      if (!detail) {
        return;
      }

      void (async () => {
        try {
          await applyOptimisticResolution(detail);
          clearOptimisticPending(
            detail.entityType,
            detail.entityId,
            detail.userId
          );
          window.location.reload();
        } catch (error) {
          console.error(
            'error. failed to apply optimistic lock resolution',
            error
          );
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not apply your changes. Try again.'
          );
        }
      })();
    };

    window.addEventListener('alice:optimistic-lock-resolve', onResolve);
    return () => {
      window.removeEventListener('alice:optimistic-lock-resolve', onResolve);
    };
  }, []);

  return null;
}
