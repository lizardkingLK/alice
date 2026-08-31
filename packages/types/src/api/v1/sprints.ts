import { z } from 'zod';
import type { sprintsGetPayload } from '../../generated/prisma/models/sprints.js';
import { type SprintStatus } from '../../sprint-status.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

export const sprintProjectSelect = {
  id: true,
  key: true,
  name: true,
} as const;

export const sprintListSelect = {
  id: true,
  project_id: true,
  name: true,
  goal: true,
  start_date: true,
  end_date: true,
  status: true,
  summary_report: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
  project: { select: sprintProjectSelect },
} as const;

export const sprintDetailSelect = sprintListSelect;

export type SprintListRow = sprintsGetPayload<{
  select: typeof sprintListSelect;
}>;

export type SprintDetailRow = sprintsGetPayload<{
  select: typeof sprintDetailSelect;
}>;

export type SprintPrismaListFilters = {
  projectId?: string;
  projectIds?: readonly string[];
  status?: SprintStatus[];
};

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

export const listSprintsQuerySchema = z
  .object({
    page: paginatedListPageField,
    limit: paginatedListLimitField(5),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    projectId: optionalUuid,
    tab: z.preprocess(
      emptyToUndefined,
      z.enum(['active', 'archived']).optional()
    ),
  })
  .transform((query) => {
    return {
      page: query.page,
      limit: query.limit,
      search: query.search,
      projectId: query.projectId,
      tab: query.tab,
    };
  });

export type ListSprintsQuery = z.infer<typeof listSprintsQuerySchema>;
