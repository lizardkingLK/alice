import type { Database, UserDetailRow, UserPrismaListFilters } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditUpdate,
  prismaLockTimestampRange,
} from '../../../lib/prisma-audit';
import {
  OptimisticLockError,
  resolveOptimisticPrismaUpdate,
} from '../../../lib/optimistic-lock';
import {
  filterProductUsableUsers,
  UserMembershipStatusEnum,
  UserRoleEnum,
  userListSelect,
  userDetailSelect,
  paginationMeta,
} from '@repo/types';
import {
  buildUserPrismaWhere,
  userListPageSlice,
  type UserPaginatedList,
} from './users.prisma-query';


export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  active: boolean;
  membership_status: 'pending' | 'active';
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export class UsersRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find user by id:', error.message);
      throw new Error('Failed to find user');
    }

    return data as UserRow | null;
  }

  /** Membership-active admins with kill switch on, other than `excludeUserId`. */
  async countOtherActiveAdmins(excludeUserId: string): Promise<number> {
    const { count, error } = await filterProductUsableUsers(
      this.db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', UserRoleEnum.admin)
    ).neq('id', excludeUserId);

    if (error) {
      console.error(
        'error. failed to count other active admins:',
        error.message
      );
      throw new Error('Failed to verify admin coverage');
    }

    return count ?? 0;
  }

  /**
   * Deactivate under a row lock with last-admin protection (Postgres RPC).
   * Throws on last-admin / not-found; maps optimistic conflicts to OptimisticLockError.
   */
  async deactivateGuarded(
    id: string,
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<UserRow> {
    const { data, error } = await this.db.rpc('deactivate_user_guarded', {
      p_user_id: id,
      p_actor_id: actorId,
      p_expected_updated_at: expectedUpdatedAt,
    });

    if (error) {
      const message = error.message ?? '';
      if (message.includes('Cannot deactivate the last active admin')) {
        throw new Error('Cannot deactivate the last active admin.');
      }
      if (message.includes('User not found')) {
        throw new Error('User not found.');
      }
      if (message.includes('OPTIMISTIC_LOCK_CONFLICT')) {
        const current = await this.findById(id);
        if (!current) {
          throw new Error('User not found.');
        }
        throw new OptimisticLockError(current);
      }
      console.error('error. deactivate_user_guarded failed:', message);
      throw new Error('Failed to deactivate user');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('User not found.');
    }

    return row as UserRow;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find user by email:', error.message);
      throw new Error('Failed to find user by email');
    }

    return data as UserRow | null;
  }

  async create(
    data: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>,
    actorId: string
  ): Promise<UserRow> {
    const created = await prisma.users.create({
      data: {
        ...data,
        active: true,
        membership_status: UserMembershipStatusEnum.pending,
        ...prismaAuditCreate(actorId),
      },
    });

    const row = await this.findById(created.id);
    if (!row) {
      throw new Error('Database registration failed');
    }
    return row;
  }

  async update(
    id: string,
    data: Partial<
      Omit<UserRow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'email'>
    >,
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<UserRow> {
    const { count } = await prisma.users.updateMany({
      where: { id, updated_at: prismaLockTimestampRange(expectedUpdatedAt) },
      data: {
        ...data,
        ...prismaAuditUpdate(actorId),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(id),
      fetchCurrent: () => this.findById(id),
      notFoundMessage: 'User not found',
    });
  }

  async listPaginated(input: {
    filters?: UserPrismaListFilters;
    search?: string;
    page: number;
    limit: number;
  }): Promise<UserPaginatedList> {
    const where = buildUserPrismaWhere(input.filters, input.search);
    const { skip, take } = userListPageSlice(input.page, input.limit);

    try {
      const [users, totalCount] = await Promise.all([
        prisma.users.findMany({
          where,
          select: userListSelect,
          orderBy: { created_at: 'desc' },
          skip,
          take,
        }),
        prisma.users.count({ where }),
      ]);

      return {
        users,
        ...paginationMeta(totalCount, input.page, input.limit),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list users:', message);
      throw new Error('Failed to list users');
    }
  }

  async getDetailById(userId: string): Promise<UserDetailRow | null> {
    try {
      return await prisma.users.findUnique({
        where: { id: userId },
        select: userDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get user detail:', message);
      throw new Error('Failed to get user');
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.users.deleteMany({ where: { id } });
  }
}
