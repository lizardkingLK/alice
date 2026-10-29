import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_IDEMPOTENCY_MS,
  ACCESS_REQUEST_LIMIT_MESSAGE,
  ACCESS_REQUEST_MAX_SUBMISSIONS,
  UserRoleEnum,
  isAccessRequestContactTitle,
  normalizeAccessRequestEmail,
  parseRequestedProjectKeysInput,
  type ContactRequestInput,
} from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  AccessRequestsRepository,
  type AccessRequestsTransaction,
} from './access-requests.repository';
import type { NotificationsRepository } from '../notifications/notifications.repository';

async function requireAdmin(actorId: string) {
  return requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage access requests.'
  );
}

function requestedKeysFromContact(
  input: ContactRequestInput
): string[] | undefined {
  if (input.requestedProjectKeys === undefined) {
    return undefined;
  }
  return parseRequestedProjectKeysInput(input.requestedProjectKeys);
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

    const requestedProjectKeys = requestedKeysFromContact(input);
    const now = Date.now();
    const windowStart = this.accessRequestsRepository.rollingWindowStart();
    const pending =
      await this.accessRequestsRepository.findPendingByEmail(email);

    if (pending) {
      const lastMs = new Date(pending.last_requested_at).getTime();
      if (now - lastMs < ACCESS_REQUEST_IDEMPOTENCY_MS) {
        await this.accessRequestsRepository.updateMessageOnly(
          pending.id,
          input.message,
          requestedProjectKeys
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
        {
          message: input.message,
          requestCount: nextCount,
          requestedProjectKeys,
        }
      );
    } else {
      request = await this.accessRequestsRepository.create({
        requesterEmail: email,
        requesterName: input.name,
        message: input.message,
        requestedProjectKeys: requestedProjectKeys ?? null,
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

    const resolved =
      await this.accessRequestsRepository.resolvePendingAndArchive({
        id: requestId,
        status: 'denied',
        actorId,
      });
    if (!resolved) {
      throw new Error('This access request is already resolved.');
    }
  }

  async markGrantedForRequest(
    actorId: string,
    requestId: string,
    email: string,
    transaction?: AccessRequestsTransaction
  ): Promise<void> {
    const normalized = normalizeAccessRequestEmail(email);
    const existing = await this.accessRequestsRepository.findById(
      requestId,
      transaction
    );
    if (!existing) {
      throw new Error('Access request not found');
    }
    if (existing.status !== 'pending') {
      throw new Error('This access request is already resolved.');
    }
    if (
      !normalized ||
      normalizeAccessRequestEmail(existing.requester_email) !== normalized
    ) {
      throw new Error('Access request does not match the allowlist email.');
    }

    const resolved =
      await this.accessRequestsRepository.resolvePendingAndArchive(
        {
          id: requestId,
          status: 'granted',
          actorId,
        },
        transaction
      );
    if (!resolved) {
      throw new Error('This access request is already resolved.');
    }
  }

  async markGrantedForEmail(
    actorId: string,
    email: string,
    transaction?: AccessRequestsTransaction
  ) {
    const normalized = normalizeAccessRequestEmail(email);
    if (!normalized) {
      return;
    }

    const pending = await this.accessRequestsRepository.findPendingByEmail(
      normalized,
      transaction
    );
    if (!pending) {
      return;
    }

    const resolved =
      await this.accessRequestsRepository.resolvePendingAndArchive(
        {
          id: pending.id,
          status: 'granted',
          actorId,
        },
        transaction
      );
    if (!resolved) {
      throw new Error('This access request is already resolved.');
    }
  }
}
