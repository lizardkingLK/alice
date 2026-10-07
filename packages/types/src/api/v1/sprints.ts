import { z } from 'zod';
import type { sprintsGetPayload } from '../../generated/prisma/models/sprints.js';
import { type SprintStatus } from '../../sprint-status.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

const sprintDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const sprintCreateFields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  goal: z.string().trim().max(2000).nullable().optional(),
  startDate: sprintDateStringSchema,
  endDate: sprintDateStringSchema,
};

export function normalizeSprintGoal(
  goal: string | null | undefined
): string | null {
  return goal === undefined || goal === '' ? null : goal;
}

function withValidSprintDateRange<T extends z.ZodObject>(schema: T) {
  return schema.refine(
    (data) => {
      const dates = data as { startDate: string; endDate: string };
      return dates.endDate >= dates.startDate;
    },
    {
      message: 'End date must be on or after the start date',
      path: ['endDate'],
    }
  );
}

/** Sprint fields accepted while creating a project; the project id is derived. */
export const initialSprintSchema = withValidSprintDateRange(
  z.object(sprintCreateFields).strict()
);

export type InitialSprintInput = z.infer<typeof initialSprintSchema>;

/** Standalone sprint-create contract. */
export const createSprintBodySchema = withValidSprintDateRange(
  z.object({
    ...sprintCreateFields,
    projectId: z.uuid('Project ID must be a valid UUID'),
  })
);

export type CreateSprintBody = z.infer<typeof createSprintBodySchema>;

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

export const SprintTabEnum = {
  Active: 'active',
  Archived: 'archived',
} as const;

export type SprintTab = (typeof SprintTabEnum)[keyof typeof SprintTabEnum];

export const listSprintsQuerySchema = z
  .object({
    page: paginatedListPageField,
    limit: paginatedListLimitField(5),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    projectId: optionalUuid,
    tab: z.preprocess(
      emptyToUndefined,
      z.enum([SprintTabEnum.Active, SprintTabEnum.Archived]).optional()
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

export const DeleteSprintWorkItemsActionEnum = {
  MoveOut: 'move_out',
  DeleteContent: 'delete_content',
} as const;

export type DeleteSprintWorkItemsAction =
  (typeof DeleteSprintWorkItemsActionEnum)[keyof typeof DeleteSprintWorkItemsActionEnum];

export const DELETE_SPRINT_WORK_ITEMS_ACTIONS = [
  DeleteSprintWorkItemsActionEnum.MoveOut,
  DeleteSprintWorkItemsActionEnum.DeleteContent,
] as const;

export const deleteSprintActionSchema = z.object({
  workItemsAction: z
    .enum(DELETE_SPRINT_WORK_ITEMS_ACTIONS)
    .default(DeleteSprintWorkItemsActionEnum.MoveOut),
});

export type DeleteSprintAction = z.infer<typeof deleteSprintActionSchema>;
