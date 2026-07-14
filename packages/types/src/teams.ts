import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().nullable().optional(),
  manager_id: z.uuid({ message: 'Please select a valid manager.' }),
  tech_stack: z.string().nullable().optional(),
  status: z
    .enum(['active', 'inactive', 'archived', 'deleted'])
    .default('active'),
  member_ids: z.array(z.uuid()).optional(),
});

export const updateTeamSchema = createTeamSchema.partial();
