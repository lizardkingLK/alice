import { z } from 'zod';

/** Shared Supabase project column list for embeds / selects. */
export const PROJECT_PROJECTION = 'id, name, key' as const;

export type ProjectProjection = typeof PROJECT_PROJECTION;

/**
 * Build a PostgREST project relation embed, e.g. `project:projects(id, name, key)`.
 * Pass a nested parent select when needed:
 * `work_item:work_items(id, title, type, ${projectRelationSelect()})`.
 */
export function projectRelationSelect(
  alias = 'project',
  projection: ProjectProjection = PROJECT_PROJECTION
): string {
  return `${alias}:projects(${projection})`;
}

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
