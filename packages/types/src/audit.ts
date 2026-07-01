import type { Enums } from './generated/supabase/database.types.js';

export type RecordStatus = Enums<'RecordStatus'>;

function nowIso(): string {
  return new Date().toISOString();
}

/** Audit columns for INSERT on tables that use `RecordStatus`. */
export function auditCreate(actorId: string) {
  return {
    status: 'active' as const satisfies RecordStatus,
    created_by: actorId,
    updated_by: actorId,
    updated_at: nowIso(),
  };
}

/**
 * Audit columns for INSERT on tables with a domain status enum
 * (`ProjectStatus`, `SprintStatus`, `WorkItemStatus`).
 */
export function auditCreateWithoutStatus(actorId: string) {
  return {
    created_by: actorId,
    updated_by: actorId,
    updated_at: nowIso(),
  };
}

/** Audit columns for UPDATE — sets `updated_by` and `updated_at`. */
export function auditUpdate(actorId: string) {
  return {
    updated_by: actorId,
    updated_at: nowIso(),
  };
}

/** Sync `users.active` with `users.status` and audit an admin toggle. */
export function userActiveAuditUpdate(actorId: string, active: boolean) {
  return {
    active,
    status: (active ? 'active' : 'inactive') as RecordStatus,
    ...auditUpdate(actorId),
  };
}
