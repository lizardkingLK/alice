import type { Prisma } from '@repo/types/prisma';
import type {
  PaginationMeta,
  UserListRow,
  UserPrismaListFilters,
} from '@repo/types';

export function buildUserPrismaWhere(
  filters?: UserPrismaListFilters,
  search?: string
): Prisma.usersWhereInput {
  const where: Prisma.usersWhereInput = {};

  if (filters?.role) {
    where.role = filters.role;
  }

  if (filters?.active !== undefined) {
    where.active = filters.active;
  }

  const term = search?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

export function userListPageSlice(
  page: number,
  limit: number
): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export type UserPaginatedList<TRow = UserListRow> = {
  users: TRow[];
} & PaginationMeta;
