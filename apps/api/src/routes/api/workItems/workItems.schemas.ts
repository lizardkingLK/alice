import { WORK_ITEM_STATUSES } from '@repo/types';
import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const workItemTypeSchema = z.enum(['Epic', 'Story', 'Task'], {
  message: 'Please select a work item type',
});

export const workItemStatusSchema = z.enum(WORK_ITEM_STATUSES, {
  message: 'Please select a valid status',
});

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize DB/ISO timestamps to `YYYY-MM-DD` for comparisons. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.split('T')[0] ?? null;
}

/**
 * PATCH may resubmit an existing past due date (edit forms). Block only when
 * the client changes due_date to a *new* past date.
 */
export function isBlockedPastDueDateChange(
  nextDueDate: string | null | undefined,
  existingDueDate: string | null | undefined
): boolean {
  if (nextDueDate === undefined || nextDueDate === null) {
    return false;
  }
  if (nextDueDate >= todayDateString()) {
    return false;
  }
  return nextDueDate !== toDateOnly(existingDueDate);
}

function emptyStringToNull(value: unknown): unknown {
  return value === '' || value === undefined ? null : value;
}

function stringToNumberOrNull(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
export type SupabaseJson =
  Literal | { [key: string]: SupabaseJson } | SupabaseJson[];

export const jsonSchema: z.ZodType<SupabaseJson> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(z.lazy(() => jsonSchema)),
    z.record(
      z.string(),
      z.lazy(() => jsonSchema)
    ),
  ])
) as z.ZodType<SupabaseJson>;

export const workItemCoreObject = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  project_id: z.uuid({ message: 'Please select a valid project' }),
  type: workItemTypeSchema,
  assignee_id: z.preprocess(
    emptyStringToNull,
    z.uuid({ message: 'Please select a valid assignee' }).nullable()
  ),
  reporter_id: z
    .preprocess(
      emptyStringToNull,
      z.uuid({ message: 'Please select a valid reporter' }).nullable()
    )
    .optional(),
  due_date: z.preprocess(emptyStringToNull, dateStringSchema.nullable()),
  description: jsonSchema.nullable().optional(),
  sprint_id: z
    .preprocess(
      emptyStringToNull,
      z.uuid({ message: 'Please select a valid sprint' }).nullable()
    )
    .optional(),
  story_points: z
    .preprocess(
      stringToNumberOrNull,
      z
        .number()
        .int({ message: 'Story points must be a whole number' })
        .min(0, { message: 'Story points must be at least 0' })
        .nullable()
    )
    .optional(),
});

export const createUpdateWorkItemBodySchema = workItemCoreObject.refine(
  (data) => {
    if (data.due_date) return data.due_date >= todayDateString();
    return true;
  },
  {
    message: 'Due date must be on or after today',
    path: ['due_date'],
  }
);

/** PATCH: past due dates allowed when unchanged; see isBlockedPastDueDateChange. */
export const patchUpdateWorkItemBodySchema = workItemCoreObject
  .extend({
    status: workItemStatusSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type WorkItemBody = z.infer<typeof createUpdateWorkItemBodySchema>;
export type PatchWorkItemBody = z.infer<typeof patchUpdateWorkItemBodySchema>;
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;
export type WorkItemUpdateBody = WorkItemBody & {
  status: WorkItemStatus;
};

const workLogDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const createWorkLogSchema = z.object({
  logged_hours: z.preprocess(
    (v) => (typeof v === 'string' ? Number(v) : v),
    z
      .number()
      .positive()
      .max(1000)
      .refine((n) => Number.isFinite(n), {
        message: 'Logged hours must be a finite number',
      })
  ),
  // Jira-like: date the work was done (defaults to today in the route).
  logged_at: workLogDateOnlySchema.optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

export type CreateWorkLogBody = z.infer<typeof createWorkLogSchema>;
