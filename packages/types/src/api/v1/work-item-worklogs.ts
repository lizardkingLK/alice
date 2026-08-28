import { z } from 'zod';
import type { work_item_worklogsGetPayload } from '../../generated/prisma/models/work_item_worklogs.js';
import { workItemUserSelect } from './work-items.js';

/**
 * Prisma `select` for unused Express work-log list GETs.
 * Field list must stay aligned with `WORK_ITEM_WORKLOG_SELECT` in `work-item-worklogs.ts`.
 */
export const workLogAuthorSelect = workItemUserSelect;

export const workLogListSelect = {
  id: true,
  work_item_id: true,
  user_id: true,
  logged_hours: true,
  logged_at: true,
  comment: true,
  user: { select: workLogAuthorSelect },
} as const;

export type WorkLogListRow = work_item_worklogsGetPayload<{
  select: typeof workLogListSelect;
}>;

const workLogDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const workLogAuthorWireSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  profile_picture: z.string().nullable(),
});

/** Wire shape for work-log rows (create response + list rows). */
export const workLogWireSchema = z.object({
  id: z.uuid(),
  work_item_id: z.uuid(),
  user_id: z.uuid(),
  logged_hours: z.number(),
  logged_at: z.string(),
  comment: z.string().nullable(),
  user: workLogAuthorWireSchema.nullable().optional(),
});

export type WorkLogWire = z.infer<typeof workLogWireSchema>;

export const createWorkLogSchema = z.object({
  work_item_id: z.uuid({ message: 'Invalid work item id.' }),
  logged_hours: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z
      .number()
      .positive()
      .max(1000)
      .refine((n) => Number.isFinite(n), {
        message: 'Logged hours must be a finite number',
      })
  ),
  logged_at: workLogDateOnlySchema.optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

export type CreateWorkLogBody = z.infer<typeof createWorkLogSchema>;

export const createWorkLogResponseSchema = z.object({
  worklog: workLogWireSchema,
});

export type CreateWorkLogResponse = z.infer<typeof createWorkLogResponseSchema>;

/** GET `/api/worklogs` query (unused by Next; Prisma list escape hatch). */
export const listWorkLogsQuerySchema = z.object({
  work_item_id: z.uuid({ message: 'Invalid work item id.' }),
});

export type ListWorkLogsQuery = z.infer<typeof listWorkLogsQuerySchema>;
