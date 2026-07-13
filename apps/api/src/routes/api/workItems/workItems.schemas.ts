import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const workItemTypeSchema = z.enum(['Epic', 'Story', 'Task'], {
  message: 'Please select a work item type',
});

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const createUpdateWorkItemBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(200, 'Title must be at most 200 characters'),
    project_id: z.uuid({ message: 'Please select a valid project' }),
    type: workItemTypeSchema,
    assignee_id: z.uuid({ message: 'Please select a valid assignee' }),
    due_date: dateStringSchema,
  })
  .refine((data) => data.due_date >= todayDateString(), {
    message: 'Due date must be on or after today',
    path: ['due_date'],
  });

export type WorkItemBody = z.infer<typeof createUpdateWorkItemBodySchema>;
