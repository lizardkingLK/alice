import {
  auditCreate,
  auditUpdate,
  normalizeSavedViewSearch,
  uniqueSavedViewIdsFromShares,
  type CreateSavedViewInput,
  type Tables,
  type UpdateSavedViewInput,
} from '@repo/types';
import { supabase } from '../../../lib/supabase';

export type SavedViewRow = Tables<'saved_views'>;
export type SavedViewShareRow = Tables<'saved_view_shares'>;

export class SavedViewsRepository {
  async create(
    ownerId: string,
    input: CreateSavedViewInput
  ): Promise<SavedViewRow> {
    const pathname = input.pathname;
    const search = normalizeSavedViewSearch(input.search ?? '');

    const active = await this.findOwnedByPath(
      ownerId,
      pathname,
      search,
      'active'
    );
    if (active) {
      return this.applyCreateInput(active.id, ownerId, input, search);
    }

    const archived = await this.findOwnedByPath(
      ownerId,
      pathname,
      search,
      'archived'
    );
    if (archived) {
      return this.applyCreateInput(archived.id, ownerId, input, search, {
        restore: true,
      });
    }

    return this.insertNew(ownerId, input, search);
  }

  private async findOwnedByPath(
    ownerId: string,
    pathname: string,
    search: string,
    status: 'active' | 'archived'
  ): Promise<SavedViewRow | null> {
    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('pathname', pathname)
      .eq('search', search)
      .eq('status', status)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  private async applyCreateInput(
    id: string,
    ownerId: string,
    input: CreateSavedViewInput,
    search: string,
    options: { readonly restore?: boolean } = {}
  ): Promise<SavedViewRow> {
    const { data, error } = await supabase
      .from('saved_views')
      .update({
        ...(options.restore ? { status: 'active' as const } : {}),
        title: input.title,
        description: input.description ?? null,
        search,
        project_id: input.projectId ?? null,
        ...auditUpdate(ownerId),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        error?.message ??
          (options.restore
            ? 'Failed to restore saved view'
            : 'Failed to update saved view')
      );
    }
    return data;
  }

  private async insertNew(
    ownerId: string,
    input: CreateSavedViewInput,
    search: string
  ): Promise<SavedViewRow> {
    const { data, error } = await supabase
      .from('saved_views')
      .insert({
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        pathname: input.pathname,
        search,
        project_id: input.projectId ?? null,
        ...auditCreate(ownerId),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create saved view');
    }
    return data;
  }

  async listOwned(
    ownerId: string,
    status: 'active' | 'archived'
  ): Promise<SavedViewRow[]> {
    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('status', status)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data ?? [];
  }

  /**
   * Shared-with-me read path — keep filters aligned with
   * `getSavedViewsPaginated` (web SSR, `tab=shared`):
   * active shares for user → unique view ids → active `saved_views`.
   * This API returns the full list; SSR adds search + pagination.
   */
  async listSharedWithMe(userId: string): Promise<SavedViewRow[]> {
    const { data: shares, error: sharesError } = await supabase
      .from('saved_view_shares')
      .select('view_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (sharesError) {
      throw new Error(sharesError.message);
    }

    const viewIds = uniqueSavedViewIdsFromShares(shares ?? []);
    if (viewIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .in('id', viewIds)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data ?? [];
  }

  async getById(id: string): Promise<SavedViewRow | null> {
    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async update(
    id: string,
    actorId: string,
    input: UpdateSavedViewInput
  ): Promise<SavedViewRow> {
    const { data, error } = await supabase
      .from('saved_views')
      .update({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...auditUpdate(actorId),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update saved view');
    }
    return data;
  }

  async setStatus(
    id: string,
    actorId: string,
    status: 'active' | 'archived'
  ): Promise<SavedViewRow> {
    const { data, error } = await supabase
      .from('saved_views')
      .update({
        status,
        ...auditUpdate(actorId),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update saved view status');
    }
    return data;
  }

  async listProjectMemberIds(projectId: string): Promise<string[]> {
    return this.listActiveMemberUserIds({
      table: 'project_members',
      idColumn: 'project_id',
      id: projectId,
    });
  }

  async listTeamMemberIds(teamId: string): Promise<string[]> {
    return this.listActiveMemberUserIds({
      table: 'team_members',
      idColumn: 'team_id',
      id: teamId,
    });
  }

  private async listActiveMemberUserIds(
    params:
      | {
          readonly table: 'project_members';
          readonly idColumn: 'project_id';
          readonly id: string;
        }
      | {
          readonly table: 'team_members';
          readonly idColumn: 'team_id';
          readonly id: string;
        }
  ): Promise<string[]> {
    const query =
      params.table === 'project_members'
        ? supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', params.id)
            .eq('status', 'active')
        : supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', params.id)
            .eq('status', 'active');

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => row.user_id);
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase.from('saved_views').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async listActiveShareUserIds(viewId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('saved_view_shares')
      .select('user_id')
      .eq('view_id', viewId)
      .eq('status', 'active');

    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => row.user_id);
  }

  async deleteShare(params: {
    readonly viewId: string;
    readonly userId: string;
  }): Promise<void> {
    const { data, error } = await supabase
      .from('saved_view_shares')
      .delete()
      .eq('view_id', params.viewId)
      .eq('user_id', params.userId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Shared view not found');
    }
  }

  async upsertShares(params: {
    readonly viewId: string;
    readonly actorId: string;
    readonly userIds: readonly string[];
  }): Promise<number> {
    if (params.userIds.length === 0) {
      return 0;
    }

    const rows = params.userIds.map((userId) => ({
      view_id: params.viewId,
      user_id: userId,
      ...auditCreate(params.actorId),
    }));

    const { data, error } = await supabase
      .from('saved_view_shares')
      .upsert(rows, { onConflict: 'view_id,user_id' })
      .select('id');

    if (error) {
      throw new Error(error.message);
    }
    return data?.length ?? 0;
  }
}

export const savedViewsRepository = new SavedViewsRepository();
