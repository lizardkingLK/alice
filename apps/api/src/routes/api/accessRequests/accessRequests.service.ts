import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_IDEMPOTENCY_MS,
  ACCESS_REQUEST_LIMIT_MESSAGE,
  ACCESS_REQUEST_MAX_SUBMISSIONS,
  UserRoleEnum,
  isAccessRequestContactTitle,
  normalizeAccessRequestEmail,
  type ContactRequestInput,
} from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import { AccessRequestsRepository } from './accessRequests.repository';
import type { NotificationsRepository } from '../notifications/notifications.repository';

async function requireAdmin(actorId: string) {
  return requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage access requests.'
  );
}

export class AccessRequestsService {
  constructor(
    private readonly accessRequestsRepository: AccessRequestsRepository,
    private readonly notificationsRepository: NotificationsRepository
  ) {}

  async submitFromContact(
    input: ContactRequestInput
  ): Promise<{ requestId?: string }> {
    if (!isAccessRequestContactTitle(input.title)) {
      await this.notificationsRepository.createMany({
        fromEmail: input.email,
        fromName: input.name,
        message: input.message,
        title: input.title,
      });
      return {};
    }

    const email = normalizeAccessRequestEmail(input.email);
    if (!email) {
      throw new Error('Please enter a valid email address.');
    }

    const now = Date.now();
    const windowStart = this.accessRequestsRepository.rollingWindowStart();
    const pending =
      await this.accessRequestsRepository.findPendingByEmail(email);

    if (pending) {
      const lastMs = new Date(pending.last_requested_at).getTime();
      if (now - lastMs < ACCESS_REQUEST_IDEMPOTENCY_MS) {
        await this.accessRequestsRepository.updateMessageOnly(
          pending.id,
          input.message
        );
        return { requestId: pending.id };
      }
    }

    const submissionsInWindow =
      await this.accessRequestsRepository.sumSubmissionCountInWindow(
        email,
        windowStart
      );

    if (submissionsInWindow >= ACCESS_REQUEST_MAX_SUBMISSIONS) {
      throw new Error(ACCESS_REQUEST_LIMIT_MESSAGE);
    }

    const latest = await this.accessRequestsRepository.findLatestByEmail(email);
    if (
      latest?.status === 'granted' &&
      latest.kind === 'admission' &&
      !pending
    ) {
      throw new Error(ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE);
    }

    let request;
    if (pending) {
      const nextCount = pending.request_count + 1;
      if (submissionsInWindow + 1 > ACCESS_REQUEST_MAX_SUBMISSIONS) {
        throw new Error(ACCESS_REQUEST_LIMIT_MESSAGE);
      }
      request = await this.accessRequestsRepository.updatePendingSubmission(
        pending.id,
        { message: input.message, requestCount: nextCount }
      );
    } else {
      request = await this.accessRequestsRepository.create({
        requesterEmail: email,
        requesterName: input.name,
        message: input.message,
      });
    }

    await this.notificationsRepository.createManyForAccessRequest({
      requestId: request.id,
      fromEmail: email,
      fromName: input.name,
      message: input.message,
    });

    return { requestId: request.id };
  }

  async denyAccessRequest(actorId: string, requestId: string) {
    await requireAdmin(actorId);

    const existing = await this.accessRequestsRepository.findById(requestId);
    if (!existing) {
      throw new Error('Access request not found');
    }
    if (existing.status !== 'pending') {
      throw new Error('This access request is already resolved.');
    }

    await this.accessRequestsRepository.resolveRequest({
      id: requestId,
      status: 'denied',
      actorId,
    });
    await this.accessRequestsRepository.archiveNotificationsForRequest(
      requestId
    );
  }

  async markGrantedForEmail(actorId: string, email: string) {
    const normalized = normalizeAccessRequestEmail(email);
    if (!normalized) {
      return;
    }

    const pending =
      await this.accessRequestsRepository.findPendingByEmail(normalized);
    if (!pending) {
      return;
    }

    await this.accessRequestsRepository.resolveRequest({
      id: pending.id,
      status: 'granted',
      actorId,
    });
    await this.accessRequestsRepository.archiveNotificationsForRequest(
      pending.id
    );
  }
}
