import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  key: z
    .string()
    .min(2, { message: 'Key must be at least 2 characters.' })
    .max(10, { message: 'Key must be at most 10 characters.' })
    .regex(/^[A-Z0-9]+$/, {
      message: 'Key must contain only uppercase letters and numbers.',
    }),
  description: z.string().nullable().optional(),
  owner_id: z.uuid({ message: 'Please select a valid owner.' }),
  start_date: z.string().or(z.null()).optional(),
  end_date: z.string().or(z.null()).optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

export const updateProjectSchema = createProjectSchema.partial();
