import {
  normalizeSavedViewSearch,
  uniqueSavedViewIdsFromShares,
  type CreateSavedViewInput,
  type Tables,
  type UpdateSavedViewInput,
} from '@repo/types';
import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';

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
    await prisma.saved_views.update({
      where: { id },
      data: {
        ...(options.restore ? { status: 'active' as const } : {}),
        title: input.title,
        description: input.description ?? null,
        search,
        project_id: input.projectId ?? null,
        ...prismaAuditUpdate(ownerId),
      },
    });

    const row = await this.getById(id);
    if (!row) {
      throw new Error(
        options.restore
          ? 'Failed to restore saved view'
          : 'Failed to update saved view'
      );
    }
    return row;
  }

  private async insertNew(
    ownerId: string,
    input: CreateSavedViewInput,
    search: string
  ): Promise<SavedViewRow> {
    const created = await prisma.saved_views.create({
      data: {
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        pathname: input.pathname,
        search,
        project_id: input.projectId ?? null,
        ...prismaAuditCreate(ownerId),
      },
    });

    const row = await this.getById(created.id);
    if (!row) {
      throw new Error('Failed to create saved view');
    }
    return row;
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
    await prisma.saved_views.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...prismaAuditUpdate(actorId),
      },
    });

    const row = await this.getById(id);
    if (!row) {
      throw new Error('Failed to update saved view');
    }
    return row;
  }

  async setStatus(
    id: string,
    actorId: string,
    status: 'active' | 'archived'
  ): Promise<SavedViewRow> {
    await prisma.saved_views.update({
      where: { id },
      data: {
        status,
        ...prismaAuditUpdate(actorId),
      },
    });

    const row = await this.getById(id);
    if (!row) {
      throw new Error('Failed to update saved view status');
    }
    return row;
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
    await prisma.saved_views.delete({ where: { id } });
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
    const deleted = await prisma.saved_view_shares.deleteMany({
      where: { view_id: params.viewId, user_id: params.userId },
    });
    if (deleted.count === 0) {
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

    const results = await prisma.$transaction(
      params.userIds.map((userId) =>
        prisma.saved_view_shares.upsert({
          where: {
            view_id_user_id: { view_id: params.viewId, user_id: userId },
          },
          create: {
            view_id: params.viewId,
            user_id: userId,
            ...prismaAuditCreate(params.actorId),
          },
          update: prismaAuditCreate(params.actorId),
        })
      )
    );
    return results.length;
  }
}

export const savedViewsRepository = new SavedViewsRepository();
