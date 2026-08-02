'use client';

import { useEffect } from 'react';
import { forceUpdateComment } from '@/app/comments/_services/comments.service';
import { forceUpdateProject } from '@/app/projects/_services/projects.service';
import {
  forceUpdateSprint,
  forceUpdateSprintStatus,
} from '@/app/sprints/_services/sprints.service';
import { forceUpdateTeam } from '@/app/manager/_services/teams.service';
import { forceUpdateUser } from '@/app/users/_services/users.service';
import { forceUpdateAccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service';
import { forceUpdateWorkItemFields } from '@/app/work-items/_services/workItem.service.client';
import { apiFetch } from '@/lib/api/api-client';
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
      if (pendingFields.status !== undefined) {
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
      return;
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
          console.error('Failed to apply optimistic lock resolution:', error);
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
