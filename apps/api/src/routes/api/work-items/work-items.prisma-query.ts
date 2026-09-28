import type { Prisma } from '@repo/types/prisma';
import type {
  PaginationMeta,
  WorkItemListRow,
  WorkItemPrismaListFilters,
} from '@repo/types';

function applyProjectFilters(
  where: Prisma.work_itemsWhereInput,
  filters?: WorkItemPrismaListFilters
): void {
  if (filters?.sprintId === null) {
    where.sprint_id = null;
  } else if (filters?.sprintId) {
    where.sprint_id = filters.sprintId;
  }

  if (filters?.projectId) {
    if (filters.projectIds && !filters.projectIds.includes(filters.projectId)) {
      where.project_id = { in: [] };
    } else {
      where.project_id = filters.projectId;
    }
  } else if (filters?.projectIds) {
    where.project_id = { in: [...filters.projectIds] };
  }

  if (filters?.parentId === null) {
    where.parent_id = null;
  } else if (filters?.parentId) {
    where.parent_id = filters.parentId;
  }
}

function buildSearchAndClauses(
  filters?: WorkItemPrismaListFilters,
  search?: string
): Prisma.work_itemsWhereInput[] {
  const and: Prisma.work_itemsWhereInput[] = [];

  if (filters?.labels?.length) {
    and.push({
      OR: filters.labels.map((label) => ({
        labels: { array_contains: [label] },
      })),
    });
  }

  const term = search?.trim();
  if (!term) {
    return and;
  }

  const ilikeTerm = term.replaceAll(/[,()]/g, '');
  const searchOr: Prisma.work_itemsWhereInput[] = [];
  if (ilikeTerm) {
    searchOr.push({
      title: { contains: ilikeTerm, mode: 'insensitive' },
    });
  }
  searchOr.push({ labels: { array_contains: [term] } });
  and.push({ OR: searchOr });
  return and;
}

/** Matches RSC `applyWorkItemFilters` + `buildWorkItemSearchOrFilter`. */
export function buildWorkItemPrismaListWhere(
  filters?: WorkItemPrismaListFilters,
  search?: string
): Prisma.work_itemsWhereInput {
  const where: Prisma.work_itemsWhereInput = {};

  applyProjectFilters(where, filters);

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.assigneeId) {
    where.assignee_id = filters.assigneeId;
  }

  where.record_status = filters?.recordStatus ?? 'active';

  if (filters?.dueDate === 'null') {
    where.due_date = null;
  } else if (filters?.dueDate === 'not_null') {
    where.due_date = { not: null };
  } else if (filters?.dueDate && typeof filters.dueDate === 'object') {
    where.due_date = {
      gte: new Date(`${filters.dueDate.from}T00:00:00.000Z`),
      lte: new Date(`${filters.dueDate.to}T23:59:59.999Z`),
    };
  }

  if (filters?.excludeStatuses?.length) {
    where.status = { notIn: [...filters.excludeStatuses] };
  }

  const and = buildSearchAndClauses(filters, search);
  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export function workItemListPageSlice(
  page: number,
  limit: number
): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export type WorkItemPaginatedList<TRow = WorkItemListRow> = {
  workItems: TRow[];
} & PaginationMeta;
