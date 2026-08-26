import type { WorkItemType } from '@repo/types';

export type ProjectRow = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: 'active' | 'archived';
  start_date: string | null;
  end_date: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  jira_url: string | null;
  jira_email: string | null;
  jira_token: string | null;
  jira_project_key: string | null;
  github_repo: string | null;
  github_token: string | null;
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

export type ResolvedJiraCredentials = {
  jiraUrl: string;
  jiraToken: string;
  jiraProjectKey: string;
  jiraEmail: string;
};

export type CredentialSeed = {
  jiraUrl?: string;
  jiraToken?: string;
  jiraProjectKey?: string;
  jiraEmail?: string;
};

export interface JiraIssueField {
  summary?: string;
  issuetype?: {
    name?: string;
  };
  description?: unknown;
  parent?: {
    key?: string;
  };
}

export interface JiraIssue {
  key: string;
  fields?: JiraIssueField;
}

export interface JiraSearchResponse {
  issues?: JiraIssue[];
}

export interface JiraNode {
  type?: string;
  text?: string;
  content?: JiraNode[];
}

export interface ParsedJiraIssue {
  key: string;
  title: string;
  description: string;
  type: WorkItemType;
  parentKey?: string | null;
}

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

/** Input for creating a project (logo/cover optional until uploaded). */
export type CreateProjectInput = Omit<
  ProjectRow,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'logo_url'
  | 'cover_picture'
> & {
  logo_url?: string | null;
  cover_picture?: string | null;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;
