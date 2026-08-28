import type { Prisma } from '@repo/types/prisma';
import type {
  PaginationMeta,
  SprintListRow,
  SprintPrismaListFilters,
} from '@repo/types';

export function buildSprintPrismaListWhere(
  filters?: SprintPrismaListFilters,
  search?: string
): Prisma.sprintsWhereInput {
  const where: Prisma.sprintsWhereInput = {};

  if (filters?.projectId) {
    if (filters.projectIds && !filters.projectIds.includes(filters.projectId)) {
      where.project_id = { in: [] };
    } else {
      where.project_id = filters.projectId;
    }
  } else if (filters?.projectIds) {
    where.project_id = { in: [...filters.projectIds] };
  }

  if (filters?.status?.length) {
    where.status = { in: filters.status };
  }

  const term = search?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { goal: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

export function sprintListPageSlice(
  page: number,
  limit: number
): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export type SprintPaginatedList<TRow = SprintListRow> = {
  sprints: TRow[];
} & PaginationMeta;
