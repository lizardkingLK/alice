import { z } from 'zod';
import type { projectsGetPayload } from '../../generated/prisma/models/projects.js';
import type { project_membersGetPayload } from '../../generated/prisma/models/project_members.js';

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

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export const listProjectsQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined || value === '' ? 1 : value),
    z.coerce.number().int().min(1)
  ),
  limit: z.preprocess(
    (value) => (value === undefined || value === '' ? 10 : value),
    z.coerce.number().int().min(1).max(100)
  ),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['active', 'archived']).optional()
  ),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
