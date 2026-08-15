import { requireUserWithRole } from '../../../lib/auth-helpers';
import { UserRoleEnum, RecordStatusEnum } from '@repo/types';
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
    await requireAdmin(actorId);

    const previous =
      input.status === RecordStatusEnum.active
        ? await accessAllowlistRepository.findById(id)
        : null;

    const entry = await accessAllowlistRepository.update({
      actorId,
      id,
      label: input.label,
      expires_at: input.expires_at,
      status: input.status,
      expectedUpdatedAt: input.expectedUpdatedAt,
    });

    if (previous && previous.status !== RecordStatusEnum.active) {
      await notifyIfEmailAllowlisted(entry);
    }

    return entry;
  }

  async deleteAccessAllowlist(
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    await requireAdmin(actorId);
    return await accessAllowlistRepository.hardDelete({
      id,
      expectedUpdatedAt,
    });
  }
}

export const accessAllowlistService = new AccessAllowlistService();
