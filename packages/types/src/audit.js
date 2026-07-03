function nowIso() {
    return new Date().toISOString();
}
/** Audit columns for INSERT on tables that use `RecordStatus`. */
export function auditCreate(actorId) {
    return {
        status: 'active',
        created_by: actorId,
        updated_by: actorId,
        updated_at: nowIso(),
    };
}
/**
 * Audit columns for INSERT on tables with a domain status enum
 * (`ProjectStatus`, `SprintStatus`, `WorkItemStatus`).
 */
export function auditCreateWithoutStatus(actorId) {
    return {
        created_by: actorId,
        updated_by: actorId,
        updated_at: nowIso(),
    };
}
/** Audit columns for UPDATE — sets `updated_by` and `updated_at`. */
export function auditUpdate(actorId) {
    return {
        updated_by: actorId,
        updated_at: nowIso(),
    };
}
/** Sync `users.active` with `users.status` and audit an admin toggle. */
export function userActiveAuditUpdate(actorId, active) {
    return {
        active,
        status: (active ? 'active' : 'inactive'),
        ...auditUpdate(actorId),
    };
}
