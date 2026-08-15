import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  UserRoleEnum,
  RecordStatusEnum,
  OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE,
  isOwnAllowlistDomainLockout,
} from '@repo/types';
import {
  accessAllowlistRepository,
  type AccessAllowlistKind,
  type AccessAllowlistRow,
  type AccessAllowlistStatus,
} from './accessAllowlist.repository';
import { notifyAllowlistedEmail } from './notify-allowlisted-email';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage the access allowlist.'
  );
}

async function requireAdminAllowlistEntry(
  actorId: string,
  id: string
): Promise<{
  actor: { email: string };
  entry: AccessAllowlistRow;
}> {
  const actor = await requireAdmin(actorId);
  const entry = await accessAllowlistRepository.findById(id);
  if (!entry) {
    throw new Error('Access allowlist entry not found');
  }

  return { actor, entry };
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

export type CreateAccessAllowlistInput = {
  kind: AccessAllowlistKind;
  value: string;
  label?: string | null;
  expires_at?: string | null;
  status?: AccessAllowlistStatus;
};

export type UpdateAccessAllowlistInput = {
  label?: string | null;
  expires_at?: string | null;
  status?: AccessAllowlistStatus;
  expectedUpdatedAt: string;
};

export class AccessAllowlistService {
  async createAccessAllowlist(
    actorId: string,
    input: CreateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    await requireAdmin(actorId);

    const entry = await accessAllowlistRepository.create({
      actorId,
      kind: input.kind,
      value: input.value,
      label: input.label,
      expires_at: input.expires_at,
      status: input.status ?? RecordStatusEnum.active,
    });

    await notifyIfEmailAllowlisted(entry);

    return entry;
  }

  async updateAccessAllowlist(
    actorId: string,
    id: string,
    input: UpdateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    const { actor, entry: previous } = await requireAdminAllowlistEntry(
      actorId,
      id
    );
    rejectOwnDomainLockout(previous, actor.email, {
      nextStatus: input.status,
    });

    const entry = await accessAllowlistRepository.update({
      actorId,
      id,
      label: input.label,
      expires_at: input.expires_at,
      status: input.status,
      expectedUpdatedAt: input.expectedUpdatedAt,
    });

    if (
      input.status === RecordStatusEnum.active &&
      previous.status !== RecordStatusEnum.active
    ) {
      await notifyIfEmailAllowlisted(entry);
    }

    return entry;
  }

  async deleteAccessAllowlist(
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const { actor, entry } = await requireAdminAllowlistEntry(actorId, id);
    rejectOwnDomainLockout(entry, actor.email, { deleting: true });

    return await accessAllowlistRepository.hardDelete({
      id,
      expectedUpdatedAt,
    });
  }
}

export const accessAllowlistService = new AccessAllowlistService();
