import { supabase } from '../../../lib/supabase';
import { type RecordStatus } from '../../../lib/audit';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import {
  isValidAccessAllowlistDomain,
  normalizeAccessAllowlistDomain,
  type Tables,
} from '@repo/types';

export type AccessAllowlistRow = Tables<'access_allowlist'>;
export type AccessAllowlistKind = Tables<'access_allowlist'>['kind'];
export type AccessAllowlistStatus = RecordStatus;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeValue(kind: AccessAllowlistKind, value: string): string {
  return kind === 'domain'
    ? normalizeAccessAllowlistDomain(value)
    : normalizeEmail(value);
}

export class AccessAllowlistRepository {
  async findById(id: string): Promise<AccessAllowlistRow | null> {
    const { data, error } = await supabase
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

  async listAll(status?: AccessAllowlistStatus): Promise<AccessAllowlistRow[]> {
    let query = supabase
      .from('access_allowlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('error. failed to list access_allowlist:', error.message);
      throw new Error('Failed to list access allowlist');
    }

    return (data ?? []) as AccessAllowlistRow[];
  }

  async listPaginated(
    page: number,
    limit: number,
    status?: AccessAllowlistStatus,
    search?: string
  ): Promise<{ items: AccessAllowlistRow[]; totalCount: number }> {
    // Supabase/PostgREST returns 416 when `.range(from, to)` is out-of-bounds.
    // To keep pagination stable, we compute `totalCount` up-front and only
    // issue the ranged query when the requested page can contain rows.
    let countQuery = supabase
      .from('access_allowlist')
      .select('id', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (search) {
      const sanitized = `%${search}%`;
      countQuery = countQuery.or(
        `value.ilike.${sanitized},label.ilike.${sanitized}`
      );
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error(
        'error. failed to count access_allowlist paginated:',
        countError.message
      );
      throw new Error('Failed to list access allowlist');
    }

    const totalCount = count ?? 0;
    const from = (page - 1) * limit;

    if (totalCount === 0 || from >= totalCount) {
      return { items: [], totalCount };
    }

    const to = from + limit - 1;

    let itemsQuery = supabase
      .from('access_allowlist')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      itemsQuery = itemsQuery.eq('status', status);
    }

    if (search) {
      const sanitized = `%${search}%`;
      itemsQuery = itemsQuery.or(
        `value.ilike.${sanitized},label.ilike.${sanitized}`
      );
    }

    const { data, error } = await itemsQuery;
    if (error) {
      console.error(
        'error. failed to list access_allowlist paginated:',
        error.message
      );
      throw new Error('Failed to list access allowlist');
    }

    return { items: (data ?? []) as AccessAllowlistRow[], totalCount };
  }

  async findByKindAndValue(kind: AccessAllowlistKind, value: string) {
    const normalized = normalizeValue(kind, value);
    const { data, error } = await supabase
      .from('access_allowlist')
      .select('id')
      .eq('kind', kind)
      .eq('value', normalized)
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to find access_allowlist entry by kind/value:',
        error.message
      );
      throw new Error('Failed to validate access allowlist entry');
    }

    return data as { id: string } | null;
  }

  async create(params: {
    actorId: string;
    kind: AccessAllowlistKind;
    value: string;
    label?: string | null;
    expires_at?: string | null;
    status: AccessAllowlistStatus;
  }): Promise<AccessAllowlistRow> {
    const { actorId, kind } = params;
    const normalizedValue = normalizeValue(kind, params.value);

    if (kind === 'domain' && !isValidAccessAllowlistDomain(normalizedValue)) {
      throw new Error('Invalid domain value');
    }

    const existing = await this.findByKindAndValue(kind, params.value);
    if (existing) {
      throw new Error('This allowlist entry already exists');
    }

    const expires_at =
      params.expires_at == null || params.expires_at === ''
        ? null
        : new Date(params.expires_at).toISOString();

    const created = await prisma.access_allowlist.create({
      data: {
        kind,
        value: normalizedValue,
        label: params.label ?? null,
        expires_at: prismaOptionalDate(expires_at) ?? null,
        status: params.status,
        ...prismaAuditCreateWithoutStatus(actorId),
      },
    });

    const row = await this.findById(created.id);
    if (!row) {
      throw new Error('Failed to create access allowlist entry');
    }
    return row;
  }

  async update(params: {
    actorId: string;
    id: string;
    label?: string | null;
    expires_at?: string | null;
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

  async softDelete(params: {
    actorId: string;
    id: string;
    expectedUpdatedAt: string;
  }) {
    const { count } = await prisma.access_allowlist.updateMany({
      where: {
        id: params.id,
        updated_at: prismaLockTimestamp(params.expectedUpdatedAt),
      },
      data: {
        status: 'deleted',
        ...prismaAuditUpdate(params.actorId),
      },
    });

    await resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(params.id),
      fetchCurrent: () => this.findById(params.id),
      notFoundMessage: 'Access allowlist entry not found',
    });
  }
}

export const accessAllowlistRepository = new AccessAllowlistRepository();
