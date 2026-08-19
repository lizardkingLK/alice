import type { NotificationType } from '@repo/types';
import { Prisma, RecordStatus } from '@repo/types/prisma';

/** Audit columns for Prisma INSERT on tables that use `RecordStatus`. */
export function prismaAuditCreate(actorId: string) {
  return {
    status: RecordStatus.active,
    created_by: actorId,
    updated_by: actorId,
  };
}

/**
 * Audit columns for Prisma INSERT on tables with a domain status enum
 * (`ProjectStatus`, `SprintStatus`, `WorkItemStatus`).
 */
export function prismaAuditCreateWithoutStatus(actorId: string) {
  return {
    created_by: actorId,
    updated_by: actorId,
  };
}

/** Audit columns for Prisma UPDATE — sets `updated_by` and `updated_at`. */
export function prismaAuditUpdate(actorId: string) {
  return {
    updated_by: actorId,
    updated_at: new Date(),
  };
}

export function prismaLockTimestamp(expectedUpdatedAt: string): Date {
  return new Date(expectedUpdatedAt);
}

/** Convert an ISO/date string from DTOs into a Prisma `DateTime` value. */
export function prismaOptionalDate(
  value: string | null | undefined
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return new Date(value);
}

export function prismaNotificationCreate(
  notification: NotificationType
): Prisma.notificationsCreateManyInput {
  return {
    user_id: notification.user_id,
    type: notification.type,
    message: notification.message,
    related_item_id: notification.related_item_id ?? null,
    read_status: notification.read_status,
    status: notification.status,
    created_by: notification.created_by ?? null,
    updated_by: notification.updated_by ?? null,
  };
}
