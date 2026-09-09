import type { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.mutations.client';

export {
  ProjectStatusEnum,
  type ProjectDetailRow,
  type ProjectListRow,
  type ProjectMemberRow,
  type ListProjectsQuery,
} from '@repo/types/api/v1';

export type Project = Omit<Tables<'projects'>, 'github_token'> & {
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
  /** Active engineering teams scoped to this project (list views). */
  team_count?: number;
  /** True when a GitHub PAT is stored server-side (value never returned). */
  has_github_token?: boolean;
};

export type { Project as DbProject };

export type GetProjectsPaginatedResponse = {
  projects: Project[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateProjectInput = Omit<
  Tables<'projects'>,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'jira_connection_id'
  | 'jira_project_key'
  | 'github_repo'
  | 'github_token'
  | 'logo_url'
  | 'cover_picture'
> & {
  jira_connection_id?: string | null;
  jira_project_key?: string | null;
  github_repo?: string | null;
  /** Write-only; omit on edit when blank to leave existing PAT unchanged. */
  github_token?: string | null;
  logo_url?: string | null;
  cover_picture?: string | null;
  attributes_config?: unknown;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  user:
    | (Pick<User, 'id' | 'name' | 'email' | 'role'> & {
        profile_picture?: string | null;
      })
    | null;
};

/** Prefetched project → active members map for form UIs (e.g. team form). */
export type ProjectMembersByProjectId = Record<string, ProjectMemberWithUser[]>;
