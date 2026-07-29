import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  accessAllowlistRepository,
  type AccessAllowlistKind,
  type AccessAllowlistRow,
  type AccessAllowlistStatus,
} from './accessAllowlist.repository';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin'],
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
};

export class AccessAllowlistService {
  async listAccessAllowlist(actorId: string, status?: AccessAllowlistStatus) {
    await requireAdmin(actorId);
    return await accessAllowlistRepository.listAll(status);
  }

  async listAccessAllowlistPaginated(
    actorId: string,
    page: number,
    limit: number,
    status?: AccessAllowlistStatus,
    search?: string
  ): Promise<{ items: AccessAllowlistRow[]; totalCount: number }> {
    await requireAdmin(actorId);
    return await accessAllowlistRepository.listPaginated(
      page,
      limit,
      status,
      search
    );
  }

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
      status: input.status ?? 'active',
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
    });
  }

  async deleteAccessAllowlist(actorId: string, id: string): Promise<void> {
    await requireAdmin(actorId);
    return await accessAllowlistRepository.softDelete({ actorId, id });
  }
}

export const accessAllowlistService = new AccessAllowlistService();
