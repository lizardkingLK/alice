import type {
  InitialProjectTeamInput,
  InitialSprintInput,
  ProjectWorkflowConfig,
  WorkItemTypeRemovalStrategy,
} from '@repo/types/api/v1';

export type ProjectRow = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: 'active' | 'archived';
  start_date: string | null;
  end_date: string | null;
  owner_id: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  jira_project_key: string | null;
  jira_connection_id: string | null;
  github_repo: string | null;
  github_token: string | null;
  attributes_config?: unknown;
  workflow_config?: ProjectWorkflowConfig | null;
  logo_url: string | null;
  cover_picture: string | null;
};

export type ProjectRowWithOwner = ProjectRow & {
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type ProjectUpdateInput = Partial<
  Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'>
>;

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profile_picture?: string | null;
  } | null;
};

/** Project fields shared by create and update mutations. */
type ProjectMutationInput = Omit<
  ProjectRow,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'logo_url'
  | 'cover_picture'
> & {
  logo_url?: string | null;
  cover_picture?: string | null;
  workflow_config?: ProjectWorkflowConfig | null;
};

/** Input for creating a project with optional logo, cover, sprint, and team. */
export type CreateProjectInput = ProjectMutationInput & {
  sprint?: InitialSprintInput;
  team?: InitialProjectTeamInput;
};

export type UpdateProjectInput = Partial<ProjectMutationInput> & {
  workflow_config?: ProjectWorkflowConfig | null;
  typeRemovalStrategies?: WorkItemTypeRemovalStrategy[];
};
