import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().nullable().optional(),
  manager_id: z.uuid({ message: 'Please select a valid manager.' }),
  project_id: z.uuid({ message: 'Please select a valid project.' }),
  tech_stack: z.string().nullable().optional(),
  status: z
    .enum(['active', 'inactive', 'archived', 'deleted'])
    .default('active'),
  member_ids: z.array(z.uuid()).optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export const updateTeamMemberSchema = z
  .object({
    capacity: z
      .number()
      .int({ message: 'Capacity must be a whole number.' })
      .min(0, { message: 'Capacity must be at least 0.' })
      .nullable()
      .optional(),
    allocation: z
      .number()
      .int({ message: 'Allocation must be a whole number.' })
      .min(0, { message: 'Allocation must be at least 0.' })
      .max(100, { message: 'Allocation must be at most 100.' })
      .nullable()
      .optional(),
  })
  .refine((d) => d.capacity !== undefined || d.allocation !== undefined, {
    message: 'At least one of capacity or allocation must be provided.',
  });
