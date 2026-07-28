import { supabase } from '@/lib/supabase';
import {
  auditCreateWithoutStatus,
  auditUpdate,
  type RecordStatus,
} from '@/lib/audit';
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
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('access_allowlist')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      const sanitized = `%${search}%`;
      query = query.or(`value.ilike.${sanitized},label.ilike.${sanitized}`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error(
        'error. failed to list access_allowlist paginated:',
        error.message
      );
      throw new Error('Failed to list access allowlist');
    }

    return {
      items: (data ?? []) as AccessAllowlistRow[],
      totalCount: count ?? 0,
    };
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

    const { data, error } = await supabase
      .from('access_allowlist')
      .insert({
        kind,
        value: normalizedValue,
        label: params.label ?? null,
        expires_at,
        status: params.status,
        ...auditCreateWithoutStatus(actorId),
      })
      .select('*')
      .single();

    if (error) {
      console.error(
        'error. failed to create access_allowlist entry:',
        error.message
      );
      throw new Error('Failed to create access allowlist entry');
    }

    return data as AccessAllowlistRow;
  }

  async update(params: {
    actorId: string;
    id: string;
    label?: string | null;
    expires_at?: string | null;
    status?: AccessAllowlistStatus;
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

    const { data, error } = await supabase
      .from('access_allowlist')
      .update({
        ...(params.label !== undefined ? { label: params.label ?? null } : {}),
        ...(expires_at !== undefined ? { expires_at } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...auditUpdate(params.actorId),
      })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      console.error(
        'error. failed to update access_allowlist entry:',
        error.message
      );
      throw new Error('Failed to update access allowlist entry');
    }

    return data as AccessAllowlistRow;
  }

  async softDelete(params: { actorId: string; id: string }) {
    const { data, error } = await supabase
      .from('access_allowlist')
      .update({
        status: 'deleted',
        ...auditUpdate(params.actorId),
      })
      .eq('id', params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to delete access_allowlist entry:',
        error.message
      );
      throw new Error('Failed to delete access allowlist entry');
    }

    if (!data) {
      throw new Error('Access allowlist entry not found');
    }
  }
}

export const accessAllowlistRepository = new AccessAllowlistRepository();
