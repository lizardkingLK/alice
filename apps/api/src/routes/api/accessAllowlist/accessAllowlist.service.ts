import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  UserRoleEnum,
  RecordStatusEnum,
  OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE,
  isOwnAllowlistDomainLockout,
} from '@repo/types';
import {
  AccessAllowlistRepository,
  type AccessAllowlistKind,
  type AccessAllowlistRow,
  type AccessAllowlistStatus,
} from './accessAllowlist.repository';
import { notifyAllowlistedEmail } from './notify-allowlisted-email';
import type { ProjectsRepository } from '../projects/projects.repository';
import {
  parseAllowlistProjectKeys,
  syncAllowlistProjectMembers,
} from '../../../lib/sync-allowlist-project-members';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage the access allowlist.'
  );
}

function rejectOwnDomainLockout(
  entry: AccessAllowlistRow,
  actorEmail: string,
  options: { deleting?: boolean; nextStatus?: string | null }
): void {
  if (
    isOwnAllowlistDomainLockout({
      entry,
      actorEmail,
      deleting: options.deleting,
      nextStatus: options.nextStatus,
    })
  ) {
    throw new Error(OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE);
  }
}

async function notifyIfEmailAllowlisted(entry: AccessAllowlistRow) {
  if (entry.kind !== 'email' || entry.status !== RecordStatusEnum.active) {
    return;
  }

  try {
    await notifyAllowlistedEmail(entry.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('error. allowlist admission email failed:', message);
  }
}

async function syncEmailAllowlistProjectMembers(params: {
  readonly actorId: string;
  readonly entry: AccessAllowlistRow;
  readonly previousKeys: readonly string[];
  readonly nextKeys: readonly string[];
  readonly projectsRepository: ProjectsRepository;
}): Promise<void> {
  if (params.entry.kind !== 'email') {
    return;
  }

  await syncAllowlistProjectMembers({
    actorId: params.actorId,
    email: params.entry.value,
    previousKeys: params.previousKeys,
    nextKeys: params.nextKeys,
    entryActive: params.entry.status === RecordStatusEnum.active,
    projectsRepository: params.projectsRepository,
  });
}

export type CreateAccessAllowlistInput = {
  kind: AccessAllowlistKind;
  value: string;
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
};

export type UpdateAccessAllowlistInput = {
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
  expectedUpdatedAt: string;
};

export class AccessAllowlistService {
  constructor(
    private readonly accessAllowlistRepository: AccessAllowlistRepository,
    private readonly projectsRepository: ProjectsRepository
  ) {}

  async requireAdminAllowlistEntry(
    actorId: string,
    id: string
  ): Promise<{
    actor: { email: string };
    entry: AccessAllowlistRow;
  }> {
    const actor = await requireAdmin(actorId);
    const entry = await this.accessAllowlistRepository.findById(id);
    if (!entry) {
      throw new Error('Access allowlist entry not found');
    }

    return { actor, entry };
  }

  async createAccessAllowlist(
    actorId: string,
    input: CreateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    await requireAdmin(actorId);

    const entry = await this.accessAllowlistRepository.create({
      actorId,
      kind: input.kind,
      value: input.value,
      label: input.label,
      expires_at: input.expires_at,
      allowed_project_ids: input.allowed_project_ids,
      status: input.status ?? RecordStatusEnum.active,
    });

    await notifyIfEmailAllowlisted(entry);

    await syncEmailAllowlistProjectMembers({
      actorId,
      entry,
      previousKeys: [],
      nextKeys: parseAllowlistProjectKeys(input.allowed_project_ids),
      projectsRepository: this.projectsRepository,
    });

    return entry;
  }

  async updateAccessAllowlist(
    actorId: string,
    id: string,
    input: UpdateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    const { actor, entry: previous } = await this.requireAdminAllowlistEntry(
      actorId,
      id
    );
    rejectOwnDomainLockout(previous, actor.email, {
      nextStatus: input.status,
    });

    const entry = await this.accessAllowlistRepository.update({
      actorId,
      id,
      label: input.label,
      expires_at: input.expires_at,
      allowed_project_ids: input.allowed_project_ids,
      status: input.status,
      expectedUpdatedAt: input.expectedUpdatedAt,
    });

    if (
      input.status === RecordStatusEnum.active &&
      previous.status !== RecordStatusEnum.active
    ) {
      await notifyIfEmailAllowlisted(entry);
    }

    const previousKeys = parseAllowlistProjectKeys(
      previous.allowed_project_ids
    );
    const nextKeys =
      input.allowed_project_ids !== undefined
        ? parseAllowlistProjectKeys(input.allowed_project_ids)
        : previousKeys;

    await syncEmailAllowlistProjectMembers({
      actorId,
      entry,
      previousKeys,
      nextKeys,
      projectsRepository: this.projectsRepository,
    });

    return entry;
  }

  async deleteAccessAllowlist(
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const { actor, entry } = await this.requireAdminAllowlistEntry(actorId, id);
    rejectOwnDomainLockout(entry, actor.email, { deleting: true });

    await syncEmailAllowlistProjectMembers({
      actorId,
      entry,
      previousKeys: parseAllowlistProjectKeys(entry.allowed_project_ids),
      nextKeys: [],
      projectsRepository: this.projectsRepository,
    });

    return await this.accessAllowlistRepository.hardDelete({
      id,
      expectedUpdatedAt,
    });
  }
}
