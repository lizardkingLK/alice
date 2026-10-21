import type { Tables } from '@repo/types';
import type {
  InitialProjectTeamInput,
  InitialSprintInput,
  ProjectWorkflowConfig,
  WorkItemTypeRemovalStrategy,
} from '@repo/types/api/v1';
import type { User } from '@/app/users/_services/users.mutations.client';

export {
  ProjectStatusEnum,
  type ProjectDetailRow,
  type ProjectListRow,
  type ProjectMemberRow,
  type ListProjectsQuery,
} from '@repo/types/api/v1';

export type Project = Omit<
  Tables<'projects'>,
  | 'github_token'
  | 'pm_connection_id'
  | 'pm_external'
  | 'vc_connection_id'
  | 'vc_external'
> & {
  /** Wire aliases mapped from `pm_connection_id` / `pm_external`. */
  jira_connection_id?: string | null;
  jira_project_key?: string | null;
  /** Wire aliases mapped from `vc_connection_id` / `vc_external`. */
  github_repo?: string | null;
  github_connection_id?: string | null;
  owner?:
    | (Pick<User, 'id' | 'name' | 'email'> & {
        profile_picture?: string | null;
      })
    | null;
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

type ProjectMutationInput = Omit<
  Tables<'projects'>,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'pm_connection_id'
  | 'pm_external'
  | 'vc_connection_id'
  | 'vc_external'
  | 'logo_url'
  | 'cover_picture'
  | 'workflow_config'
> & {
  jira_connection_id?: string | null;
  jira_project_key?: string | null;
  github_repo?: string | null;
  /** Write-only; omit on edit when blank to leave existing PAT unchanged. */
  github_token?: string | null;
  logo_url?: string | null;
  cover_picture?: string | null;
  attributes_config?: unknown;
  workflow_config?: ProjectWorkflowConfig | null;
};

export type CreateProjectInput = ProjectMutationInput & {
  sprint?: InitialSprintInput;
  team?: InitialProjectTeamInput;
};

export type UpdateProjectInput = Partial<ProjectMutationInput> & {
  workflow_config?: ProjectWorkflowConfig | null;
  typeRemovalStrategies?: WorkItemTypeRemovalStrategy[];
};

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
