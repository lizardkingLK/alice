import { prisma } from '../../../lib/prisma';
import {
  accessRequestRollingWindowStart,
  type AccessRequestKind,
  type AccessRequestStatus,
} from '@repo/types';
import {
  AccessRequestKind as AccessRequestKindEnum,
  AccessRequestStatus as AccessRequestStatusEnum,
  Prisma,
} from '@repo/types/prisma';

export type AccessRequestRow = {
  id: string;
  requester_email: string;
  requester_name: string | null;
  message: string;
  kind: AccessRequestKind;
  status: AccessRequestStatus;
  request_count: number;
  requested_project_keys: unknown;
  resolved_by: string | null;
  resolved_at: string | null;
  last_requested_at: string;
  created_at: string;
  updated_at: string;
};

function toAccessRequestRow(row: {
  id: string;
  requester_email: string;
  requester_name: string | null;
  message: string;
  kind: AccessRequestKind;
  status: AccessRequestStatus;
  request_count: number;
  requested_project_keys: Prisma.JsonValue | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  last_requested_at: Date;
  created_at: Date;
  updated_at: Date;
}): AccessRequestRow {
  return {
    id: row.id,
    requester_email: row.requester_email,
    requester_name: row.requester_name,
    message: row.message,
    kind: row.kind,
    status: row.status,
    request_count: row.request_count,
    requested_project_keys: row.requested_project_keys,
    resolved_by: row.resolved_by,
    resolved_at: row.resolved_at?.toISOString() ?? null,
    last_requested_at: row.last_requested_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class AccessRequestsRepository {
  async findById(id: string): Promise<AccessRequestRow | null> {
    const row = await prisma.access_requests.findUnique({ where: { id } });
    return row ? toAccessRequestRow(row) : null;
  }

  async findPendingByEmail(email: string): Promise<AccessRequestRow | null> {
    const row = await prisma.access_requests.findFirst({
      where: {
        requester_email: email,
        status: AccessRequestStatusEnum.pending,
      },
      orderBy: { last_requested_at: 'desc' },
    });
    return row ? toAccessRequestRow(row) : null;
  }

  async findLatestByEmail(email: string): Promise<AccessRequestRow | null> {
    const row = await prisma.access_requests.findFirst({
      where: { requester_email: email },
      orderBy: { last_requested_at: 'desc' },
    });
    return row ? toAccessRequestRow(row) : null;
  }

  async sumSubmissionCountInWindow(
    email: string,
    windowStart: Date
  ): Promise<number> {
    const aggregate = await prisma.access_requests.aggregate({
      where: {
        requester_email: email,
        last_requested_at: { gte: windowStart },
      },
      _sum: { request_count: true },
    });
    return aggregate._sum.request_count ?? 0;
  }

  async create(params: {
    requesterEmail: string;
    requesterName?: string;
    message: string;
    kind?: AccessRequestKind;
    requestCount?: number;
  }): Promise<AccessRequestRow> {
    const row = await prisma.access_requests.create({
      data: {
        requester_email: params.requesterEmail,
        requester_name: params.requesterName ?? null,
        message: params.message,
        kind: params.kind ?? AccessRequestKindEnum.admission,
        request_count: params.requestCount ?? 1,
      },
    });
    return toAccessRequestRow(row);
  }

  async updatePendingSubmission(
    id: string,
    params: { message: string; requestCount: number }
  ): Promise<AccessRequestRow> {
    const row = await prisma.access_requests.update({
      where: { id },
      data: {
        message: params.message,
        request_count: params.requestCount,
        last_requested_at: new Date(),
      },
    });
    return toAccessRequestRow(row);
  }

  async updateMessageOnly(
    id: string,
    message: string
  ): Promise<AccessRequestRow> {
    const row = await prisma.access_requests.update({
      where: { id },
      data: { message, last_requested_at: new Date() },
    });
    return toAccessRequestRow(row);
  }

  async resolveRequest(params: {
    id: string;
    status: 'granted' | 'denied';
    actorId: string;
  }): Promise<AccessRequestRow> {
    const now = new Date();
    const row = await prisma.access_requests.update({
      where: { id: params.id },
      data: {
        status: params.status,
        resolved_by: params.actorId,
        resolved_at: now,
      },
    });
    return toAccessRequestRow(row);
  }

  async resolvePendingByEmail(params: {
    email: string;
    status: 'granted' | 'denied';
    actorId: string;
  }): Promise<AccessRequestRow | null> {
    const pending = await this.findPendingByEmail(params.email);
    if (!pending) {
      return null;
    }
    return this.resolveRequest({
      id: pending.id,
      status: params.status,
      actorId: params.actorId,
    });
  }

  async archiveNotificationsForRequest(requestId: string): Promise<void> {
    await prisma.notifications.updateMany({
      where: { related_item_id: requestId },
      data: {
        status: 'archived',
        read_status: true,
        updated_at: new Date(),
      },
    });
  }

  rollingWindowStart(now: Date = new Date()): Date {
    return accessRequestRollingWindowStart(now);
  }
}
