import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const workItemTypeSchema = z.enum(['Epic', 'Story', 'Task'], {
  message: 'Please select a work item type',
});

export const workItemStatusSchema = z.enum(
  ['Draft', 'New', 'ToDo', 'InProgress', 'Testing', 'Done'],
  {
    message: 'Please select a valid status',
  }
);

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyStringToNull(value: unknown): unknown {
  return value === '' || value === undefined ? null : value;
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
  due_date: z.preprocess(emptyStringToNull, dateStringSchema.nullable()),
  description: jsonSchema.nullable().optional(),
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

export const patchUpdateWorkItemBodySchema = workItemCoreObject
  .extend({
    status: workItemStatusSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })
  .refine(
    (data) => {
      if (data.due_date) {
        return data.due_date >= todayDateString();
      }
      return true;
    },
    {
      message: 'Due date must be on or after today',
      path: ['due_date'],
    }
  );

export type WorkItemBody = z.infer<typeof createUpdateWorkItemBodySchema>;
export type PatchWorkItemBody = z.infer<typeof patchUpdateWorkItemBodySchema>;
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;
export type WorkItemUpdateBody = WorkItemBody & {
  status: WorkItemStatus;
};
