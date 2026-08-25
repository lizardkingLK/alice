import { z } from 'zod';
import { Constants } from './generated/supabase/database.types.js';
import { ProjectStatus as ProjectStatusEnum } from './generated/prisma/enums.js';

export { ProjectStatusEnum };

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

const baseCreateProjectSchema = z.object({
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
  status: z
    .enum(Constants.public.Enums.ProjectStatus)
    .default(ProjectStatusEnum.active),
  jira_url: z.string().nullable().optional(),
  jira_email: z.string().nullable().optional(),
  jira_token: z.string().nullable().optional(),
  jira_project_key: z.string().nullable().optional(),
  github_repo: z.string().nullable().optional(),
  github_token: z.string().nullable().optional(),
});

export const createProjectSchema = baseCreateProjectSchema
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = data.start_date.split('T')[0] ?? '';
        const end = data.end_date.split('T')[0] ?? '';
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date must be on or after the start date.',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      if (data.start_date) {
        const today = new Date().toISOString().split('T')[0] ?? '';
        const start = data.start_date.split('T')[0] ?? '';
        return start >= today;
      }
      return true;
    },
    {
      message: 'Start date cannot be a past date.',
      path: ['start_date'],
    }
  )
  .refine(
    (data) => {
      if (data.end_date) {
        const today = new Date().toISOString().split('T')[0] ?? '';
        const end = data.end_date.split('T')[0] ?? '';
        return end >= today;
      }
      return true;
    },
    {
      message: 'End date cannot be a past date.',
      path: ['end_date'],
    }
  );

export const updateProjectSchema = baseCreateProjectSchema
  .partial()
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = data.start_date.split('T')[0] ?? '';
        const end = data.end_date.split('T')[0] ?? '';
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date must be on or after the start date.',
      path: ['end_date'],
    }
  );
