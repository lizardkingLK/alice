import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const createSprintBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    goal: z.string().trim().max(2000).nullable().optional(),
    projectId: z.uuid('Project ID must be a valid UUID'),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export type CreateSprintBody = z.infer<typeof createSprintBodySchema>;

export const updateSprintStatusSchema = z.object({
  status: z.enum(['Not Started', 'Ongoing', 'Completed', 'Archived']),
});

export type UpdateSprintStatusBody = z.infer<typeof updateSprintStatusSchema>;

export const updateSprintBodySchema = createSprintBodySchema;

export type UpdateSprintBody = z.infer<typeof updateSprintBodySchema>;

export type SprintResponse = {
  id: string;
  name: string;
  goal: string | null;
  status: 'Not Started' | 'Ongoing' | 'Completed' | 'Archived';
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

export const listSprintsQuerySchema = z.object({
  status: z.enum(['active', 'archived']).optional().default('active'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(5),
});

export type ListSprintsQuery = z.infer<typeof listSprintsQuerySchema>;

