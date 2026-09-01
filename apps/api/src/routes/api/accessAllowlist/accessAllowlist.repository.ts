import { type RecordStatus } from '../../../lib/audit';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { isPrismaUniqueConflict } from '../../../lib/prisma-errors';
import {
  OptimisticLockError,
  resolveOptimisticPrismaUpdate,
} from '../../../lib/optimistic-lock';
import {
  Database,
  isValidAccessAllowlistDomain,
  normalizeAccessAllowlistDomain,
  type Tables,
  type Json,
} from '@repo/types';
import {
  AccessAllowlistKind as AccessAllowlistKindEnum,
  Prisma,
} from '@repo/types/prisma';
import { SupabaseClient } from '@supabase/supabase-js';

export type AccessAllowlistRow = Tables<'access_allowlist'>;
export type AccessAllowlistKind = Tables<'access_allowlist'>['kind'];
export type AccessAllowlistStatus = RecordStatus;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeValue(kind: AccessAllowlistKind, value: string): string {
  return kind === AccessAllowlistKindEnum.domain
    ? normalizeAccessAllowlistDomain(value)
    : normalizeEmail(value);
}

function toAccessAllowlistRow(row: {
  id: string;
  kind: AccessAllowlistKind;
  value: string;
  label: string | null;
  expires_at: Date | null;
  allowed_project_ids: Json | null;
  status: AccessAllowlistStatus;
  created_by: string | null;
  created_at: Date;
  updated_by: string | null;
  updated_at: Date;
}): AccessAllowlistRow {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    label: row.label,
    expires_at: row.expires_at?.toISOString() ?? null,
    allowed_project_ids: row.allowed_project_ids ?? null,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_by: row.updated_by,
    updated_at: row.updated_at.toISOString(),
  };
}

export class AccessAllowlistRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<AccessAllowlistRow | null> {
    const { data, error } = await this.db
      .from('access_allowlist')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to find access_allowlist entry by id:',
        error.message
      );
      throw new Error('Failed to find access allowlist entry');
    }

    return data as AccessAllowlistRow | null;
  }

  async create(params: {
    actorId: string;
    kind: AccessAllowlistKind;
    value: string;
    label?: string | null;
    expires_at?: string | null;
    allowed_project_ids?: string[] | null;
    status: AccessAllowlistStatus;
  }): Promise<AccessAllowlistRow> {
    const { actorId, kind } = params;
    const normalizedValue = normalizeValue(kind, params.value);

    if (
      kind === AccessAllowlistKindEnum.domain &&
      !isValidAccessAllowlistDomain(normalizedValue)
    ) {
      throw new Error('Invalid domain value');
    }

    const expires_at =
      params.expires_at == null || params.expires_at === ''
        ? null
        : new Date(params.expires_at).toISOString();

    try {
      const created = await prisma.access_allowlist.create({
        data: {
          kind,
          value: normalizedValue,
          label: params.label ?? null,
          expires_at: prismaOptionalDate(expires_at) ?? null,
          allowed_project_ids: params.allowed_project_ids ?? Prisma.DbNull,
          status: params.status,
          ...prismaAuditCreateWithoutStatus(actorId),
        },
      });

      return toAccessAllowlistRow(created);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new Error('This allowlist entry already exists');
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to create access_allowlist:', message);
      throw new Error('Failed to create access allowlist entry');
    }
  }

  async update(params: {
    actorId: string;
    id: string;
    label?: string | null;
    expires_at?: string | null;
    allowed_project_ids?: string[] | null;
    status?: AccessAllowlistStatus;
    expectedUpdatedAt: string;
  }): Promise<AccessAllowlistRow> {
    let expires_at: string | null | undefined = undefined;
    if (params.expires_at !== undefined) {
      if (params.expires_at == null || params.expires_at === '') {
        expires_at = null;
      } else {
        const parsed = new Date(params.expires_at);
        if (Number.isNaN(parsed.getTime())) {
          throw new TypeError('Invalid expires_at');
        }
        expires_at = parsed.toISOString();
      }
    }

    const { count } = await prisma.access_allowlist.updateMany({
      where: {
        id: params.id,
        updated_at: prismaLockTimestamp(params.expectedUpdatedAt),
      },
      data: {
        ...(params.label !== undefined ? { label: params.label ?? null } : {}),
        ...(expires_at !== undefined
          ? { expires_at: prismaOptionalDate(expires_at) }
          : {}),
        ...(params.allowed_project_ids !== undefined
          ? { allowed_project_ids: params.allowed_project_ids ?? Prisma.DbNull }
          : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...prismaAuditUpdate(params.actorId),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(params.id),
      fetchCurrent: () => this.findById(params.id),
      notFoundMessage: 'Access allowlist entry not found',
    });
  }

  async hardDelete(params: {
    id: string;
    expectedUpdatedAt: string;
  }): Promise<void> {
    const { count } = await prisma.access_allowlist.deleteMany({
      where: {
        id: params.id,
        updated_at: prismaLockTimestamp(params.expectedUpdatedAt),
      },
    });

    if (count > 0) {
      return;
    }

    const current = await this.findById(params.id);
    if (!current) {
      throw new Error('Access allowlist entry not found');
    }
    throw new OptimisticLockError(current);
  }
}
