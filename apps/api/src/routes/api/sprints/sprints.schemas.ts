import {
  expectedUpdatedAtSchema,
  SPRINT_STATUSES,
  type SprintStatus,
} from '@repo/types';
import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const sprintBodyObjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  goal: z.string().trim().max(2000).nullable().optional(),
  projectId: z.uuid('Project ID must be a valid UUID'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

function refineSprintDates<T extends typeof sprintBodyObjectSchema>(schema: T) {
  return schema.refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
}

export const createSprintBodySchema = refineSprintDates(sprintBodyObjectSchema);

export type CreateSprintBody = z.infer<typeof createSprintBodySchema>;

export const updateSprintStatusSchema = z.object({
  status: z.enum(SPRINT_STATUSES),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const updateSprintBodySchema = refineSprintDates(
  sprintBodyObjectSchema.extend({
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
);

export type UpdateSprintBody = z.infer<typeof updateSprintBodySchema>;

export type SprintResponse = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  summaryReport?: Record<string, unknown>;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};
