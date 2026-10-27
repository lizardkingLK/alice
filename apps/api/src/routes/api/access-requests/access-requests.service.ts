import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_IDEMPOTENCY_MS,
  ACCESS_REQUEST_LIMIT_MESSAGE,
  ACCESS_REQUEST_MAX_SUBMISSIONS,
  RecordStatusEnum,
  UserRoleEnum,
  emailDomainFromAddress,
  isAccessRequestContactTitle,
  normalizeAccessRequestEmail,
  parseRequestedProjectKeysInput,
  type AccessRequestGrantInput,
  type ContactRequestInput,
} from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import { prisma } from '../../../lib/prisma';
import {
  AccessRequestsRepository,
  type AccessRequestRow,
} from './access-requests.repository';
import type { NotificationsRepository } from '../notifications/notifications.repository';
import type { AccessAllowlistRepository } from '../access-allowlist/access-allowlist.repository';
import { notifyAllowlistedEmail } from '../access-allowlist/notify-allowlisted-email';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { UsersRepository } from '../users/users.repository';

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

export type AccessRequestsGrantDeps = {
  readonly accessAllowlistRepository: AccessAllowlistRepository;
  readonly projectsRepository: ProjectsRepository;
  readonly usersRepository: UsersRepository;
};

function requireExistingRequest(
  existing: AccessRequestRow | null
): AccessRequestRow {
  if (!existing) {
    throw new Error('Access request not found');
  }
  return existing;
}

/** Pending or denied — denied supports re-grant from Edit. */
function requireGrantableRequest(
  existing: AccessRequestRow | null
): AccessRequestRow {
  const row = requireExistingRequest(existing);
  if (row.status !== 'pending' && row.status !== 'denied') {
    throw new Error('Only pending or denied access requests can be granted.');
  }
  return row;
}

/** Pending (simple deny) or granted (revoke memberships + email ACL). */
function requireDeniableRequest(
  existing: AccessRequestRow | null
): AccessRequestRow {
  const row = requireExistingRequest(existing);
  if (row.status !== 'pending' && row.status !== 'granted') {
    throw new Error('Only pending or granted access requests can be denied.');
  }
  return row;
}

function uniqueGrantProjectIds(input: AccessRequestGrantInput): string[] {
  const projectIds = [...new Set(input.projects.map((row) => row.projectId))];
  if (projectIds.length === 0) {
    throw new Error('Select at least one project to grant.');
  }
  return projectIds;
}

async function assertAccessibleProjectIds(
  projectsRepository: ProjectsRepository,
  actorId: string,
  projectIds: readonly string[]
): Promise<void> {
  const accessibleIds =
    await projectsRepository.listAccessibleProjectIds(actorId);
  const accessibleSet = new Set(accessibleIds);
  const unauthorized = projectIds.some((id) => !accessibleSet.has(id));
  if (unauthorized) {
    throw new Error(
      'Unauthorized. You can only grant projects you can access.'
    );
  }
}

async function loadProjectKeysById(
  projectIds: readonly string[]
): Promise<Map<string, string>> {
  const projectRows = await prisma.projects.findMany({
    where: { id: { in: [...projectIds] } },
    select: { id: true, key: true },
  });
  if (projectRows.length !== projectIds.length) {
    throw new Error('One or more selected projects were not found.');
  }
  return new Map(projectRows.map((row) => [row.id, row.key]));
}

function memberProjectIdsForGrant(
  coveringDomain: unknown,
  projectIds: readonly string[],
  input: AccessRequestGrantInput
): string[] {
  if (coveringDomain) {
    return [...projectIds];
  }
  return input.projects
    .filter((row) => row.addMember)
    .map((row) => row.projectId);
}

async function resolveRequesterUserId(
  usersRepository: UsersRepository,
  email: string,
  memberProjectIds: readonly string[]
): Promise<string | null> {
  if (memberProjectIds.length === 0) {
    return null;
  }
  const user = await usersRepository.findByEmail(email);
  if (!user) {
    throw new Error(
      'No Alice user exists for this email yet. Ask them to complete sign-up once, or invite them from Users, then grant again.'
    );
  }
  return user.id;
}

async function notifyAllowlistedEmailQuietly(email: string): Promise<void> {
  try {
    await notifyAllowlistedEmail(email);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('error. allowlist admission email failed:', message);
  }
}

async function createEmailAllowlistForGrant(
  accessAllowlistRepository: AccessAllowlistRepository,
  params: {
    readonly actorId: string;
    readonly email: string;
    readonly label: string | null;
    readonly projectIds: readonly string[];
    readonly keyById: ReadonlyMap<string, string>;
  }
): Promise<void> {
  const allowedKeys = params.projectIds
    .map((id) => params.keyById.get(id))
    .filter((key): key is string => Boolean(key));

  const existing = await accessAllowlistRepository.findEmailByValue(
    params.email
  );

  if (existing) {
    const wasInactive = existing.status !== RecordStatusEnum.active;
    await accessAllowlistRepository.update({
      actorId: params.actorId,
      id: existing.id,
      label: params.label,
      expires_at: null,
      allowed_project_ids: allowedKeys,
      status: RecordStatusEnum.active,
      expectedUpdatedAt: existing.updated_at,
    });
    if (wasInactive) {
      await notifyAllowlistedEmailQuietly(existing.value);
    }
    return;
  }

  const entry = await accessAllowlistRepository.create({
    actorId: params.actorId,
    kind: 'email',
    value: params.email,
    label: params.label,
    expires_at: null,
    allowed_project_ids: allowedKeys,
    status: RecordStatusEnum.active,
  });

  await notifyAllowlistedEmailQuietly(entry.value);
}

async function deactivateEmailAllowlistForDeny(
  accessAllowlistRepository: AccessAllowlistRepository,
  params: { readonly actorId: string; readonly email: string }
): Promise<void> {
  const existing = await accessAllowlistRepository.findEmailByValue(
    params.email
  );
  if (!existing || existing.status !== RecordStatusEnum.active) {
    return;
  }
  await accessAllowlistRepository.update({
    actorId: params.actorId,
    id: existing.id,
    status: RecordStatusEnum.inactive,
    expectedUpdatedAt: existing.updated_at,
  });
}

async function revokeSharedMembershipsForDeny(
  projectsRepository: ProjectsRepository,
  params: {
    readonly actorId: string;
    readonly requesterUserId: string;
  }
): Promise<string[]> {
  const [accessibleIds, memberIds] = await Promise.all([
    projectsRepository.listAccessibleProjectIds(params.actorId),
    projectsRepository.listActiveMemberProjectIds(params.requesterUserId),
  ]);
  const accessibleSet = new Set(accessibleIds);
  const revokeIds = memberIds.filter((id) => accessibleSet.has(id));
  await Promise.all(
    revokeIds.map((projectId) =>
      projectsRepository.removeMember(projectId, params.requesterUserId)
    )
  );
  return revokeIds;
}

async function ensureGrantProjectMemberships(
  projectsRepository: ProjectsRepository,
  params: {
    readonly actorId: string;
    readonly requesterUserId: string;
    readonly memberProjectIds: readonly string[];
  }
): Promise<void> {
  const { actorId, requesterUserId, memberProjectIds } = params;
  await Promise.all(
    memberProjectIds.map(async (projectId) => {
      const members = await projectsRepository.listMembers(projectId);
      if (members.some((member) => member.user_id === requesterUserId)) {
        return;
      }
      await projectsRepository.addMember(projectId, requesterUserId, actorId);
    })
  );
}

export class AccessRequestsService {
  constructor(
    private readonly accessRequestsRepository: AccessRequestsRepository,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly grantDeps?: AccessRequestsGrantDeps
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
    if (!this.grantDeps) {
      throw new Error('Access request grant is not configured.');
    }

    const { accessAllowlistRepository, projectsRepository, usersRepository } =
      this.grantDeps;

    const existing = requireDeniableRequest(
      await this.accessRequestsRepository.findById(requestId)
    );

    if (existing.status === 'granted') {
      const user = await usersRepository.findByEmail(existing.requester_email);
      if (user) {
        await revokeSharedMembershipsForDeny(projectsRepository, {
          actorId,
          requesterUserId: user.id,
        });
      }
      await deactivateEmailAllowlistForDeny(accessAllowlistRepository, {
        actorId,
        email: existing.requester_email,
      });
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

  /**
   * Projects where the requester is a member and the actor can access —
   * shown in Edit when status is granted (revoke candidates).
   */
  async listSharedMembershipProjects(actorId: string, requestId: string) {
    await requireAdmin(actorId);
    if (!this.grantDeps) {
      throw new Error('Access request grant is not configured.');
    }

    const { projectsRepository, usersRepository } = this.grantDeps;
    const existing = requireExistingRequest(
      await this.accessRequestsRepository.findById(requestId)
    );

    const user = await usersRepository.findByEmail(existing.requester_email);
    if (!user) {
      return [] as Array<{ id: string; key: string; name: string }>;
    }

    const [accessibleIds, memberIds] = await Promise.all([
      projectsRepository.listAccessibleProjectIds(actorId),
      projectsRepository.listActiveMemberProjectIds(user.id),
    ]);
    const accessibleSet = new Set(accessibleIds);
    const sharedIds = memberIds.filter((id) => accessibleSet.has(id));
    if (sharedIds.length === 0) {
      return [];
    }

    const rows = await prisma.projects.findMany({
      where: { id: { in: sharedIds } },
      select: { id: true, key: true, name: true },
      orderBy: { key: 'asc' },
    });
    return rows;
  }

  async deleteAccessRequest(actorId: string, requestId: string) {
    await requireAdmin(actorId);

    const existing = await this.accessRequestsRepository.findById(requestId);
    if (!existing) {
      throw new Error('Access request not found');
    }

    await this.accessRequestsRepository.archiveNotificationsForRequest(
      requestId
    );
    await this.accessRequestsRepository.deleteById(requestId);
  }

  async grantAccessRequest(
    actorId: string,
    requestId: string,
    input: AccessRequestGrantInput
  ) {
    await requireAdmin(actorId);
    if (!this.grantDeps) {
      throw new Error('Access request grant is not configured.');
    }

    const { accessAllowlistRepository, projectsRepository, usersRepository } =
      this.grantDeps;

    const existing = requireGrantableRequest(
      await this.accessRequestsRepository.findById(requestId)
    );
    const projectIds = uniqueGrantProjectIds(input);
    await assertAccessibleProjectIds(projectsRepository, actorId, projectIds);
    const keyById = await loadProjectKeysById(projectIds);

    const domain = emailDomainFromAddress(existing.requester_email);
    const coveringDomain = domain
      ? await accessAllowlistRepository.findActiveDomainByValue(domain)
      : null;

    const memberProjectIds = memberProjectIdsForGrant(
      coveringDomain,
      projectIds,
      input
    );
    const requesterUserId = await resolveRequesterUserId(
      usersRepository,
      existing.requester_email,
      memberProjectIds
    );

    if (!coveringDomain) {
      await createEmailAllowlistForGrant(accessAllowlistRepository, {
        actorId,
        email: existing.requester_email,
        label: existing.requester_name,
        projectIds,
        keyById,
      });
    }

    if (requesterUserId) {
      await ensureGrantProjectMemberships(projectsRepository, {
        actorId,
        requesterUserId,
        memberProjectIds,
      });
    }

    await this.accessRequestsRepository.resolveRequest({
      id: requestId,
      status: 'granted',
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
