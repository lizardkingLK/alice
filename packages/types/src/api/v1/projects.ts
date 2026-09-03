import { z } from 'zod';
import type { projectsGetPayload } from '../../generated/prisma/models/projects.js';
import type { project_membersGetPayload } from '../../generated/prisma/models/project_members.js';
import { Constants } from '../../generated/supabase/database.types.js';
import { ProjectStatus as ProjectStatusEnum } from '../../generated/prisma/enums.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

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
  jira_project_key: z.string().nullable().optional(),
  jira_connection_id: z.uuid().nullable().optional(),
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

export const updateProjectSchema = baseCreateProjectSchema.partial().refine(
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

/**
 * Strip integration secrets before project rows reach clients.
 * Deletes `github_token` and adds `has_github_token`.
 */
export function withoutIntegrationSecrets<
  T extends { github_token?: string | null },
>(project: T): Omit<T, 'github_token'> & { has_github_token: boolean } {
  const { github_token: githubToken, ...rest } = project;
  return {
    ...(rest as Omit<T, 'github_token'>),
    has_github_token: Boolean(githubToken),
  };
}

/** @deprecated Prefer `withoutIntegrationSecrets` — same mapping. */
export const withoutGithubToken = withoutIntegrationSecrets;

export const projectOwnerSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const projectListSelect = {
  id: true,
  name: true,
  key: true,
  description: true,
  owner_id: true,
  start_date: true,
  end_date: true,
  status: true,
  created_at: true,
  updated_at: true,
  logo_url: true,
  cover_picture: true,
  deleted_at: true,
  owner: { select: projectOwnerSelect },
} as const;

export const projectDetailSelect = {
  ...projectListSelect,
  jira_project_key: true,
  jira_connection_id: true,
  github_repo: true,
  github_token: true,
} as const;

export type ProjectListRow = projectsGetPayload<{
  select: typeof projectListSelect;
}>;

export type ProjectDetailRow = projectsGetPayload<{
  select: typeof projectDetailSelect;
}>;

export const projectMemberUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  profile_picture: true,
} as const;

export const projectMemberSelect = {
  project_id: true,
  user_id: true,
  status: true,
  created_at: true,
  user: { select: projectMemberUserSelect },
} as const;

export type ProjectMemberRow = project_membersGetPayload<{
  select: typeof projectMemberSelect;
}>;

type ProjectStatusType =
  (typeof ProjectStatusEnum)[keyof typeof ProjectStatusEnum];

export const listProjectsQuerySchema = z.object({
  page: paginatedListPageField,
  limit: paginatedListLimitField(),
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(
        Object.values(ProjectStatusEnum) as [
          ProjectStatusType,
          ...ProjectStatusType[],
        ]
      )
      .optional()
  ),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
