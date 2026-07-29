import type { AuthenticatedRequest } from '../middlewares/auth';

export {
  auditCreate,
  auditCreateWithoutStatus,
  auditUpdate,
  userActiveAuditUpdate,
  type RecordStatus,
} from '@repo/types/audit';

/** Returns the authenticated user's ID or throws if the request is not authenticated. */
export function requireActorId(req: AuthenticatedRequest): string {
  const actorId = req.userId;
  if (!actorId) {
    throw new Error('Authenticated user required');
  }
  return actorId;
}
