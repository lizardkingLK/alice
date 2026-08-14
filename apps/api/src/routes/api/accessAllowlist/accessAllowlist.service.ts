import { requireUserWithRole } from '../../../lib/auth-helpers';
import { UserRoleEnum, RecordStatusEnum } from '@repo/types';
import {
  accessAllowlistRepository,
  type AccessAllowlistKind,
  type AccessAllowlistRow,
  type AccessAllowlistStatus,
} from './accessAllowlist.repository';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage the access allowlist.'
  );
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

    return await accessAllowlistRepository.create({
      actorId,
      kind: input.kind,
      value: input.value,
      label: input.label,
      expires_at: input.expires_at,
      status: input.status ?? RecordStatusEnum.active,
    });
  }

  async updateAccessAllowlist(
    actorId: string,
    id: string,
    input: UpdateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    await requireAdmin(actorId);

    return await accessAllowlistRepository.update({
      actorId,
      id,
      label: input.label,
      expires_at: input.expires_at,
      status: input.status,
      expectedUpdatedAt: input.expectedUpdatedAt,
    });
  }

  async deleteAccessAllowlist(
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    await requireAdmin(actorId);
    return await accessAllowlistRepository.softDelete({
      actorId,
      id,
      expectedUpdatedAt,
    });
  }
}

export const accessAllowlistService = new AccessAllowlistService();
