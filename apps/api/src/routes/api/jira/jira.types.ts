import type { WorkItemType } from '@repo/types';

export type JiraConnectionStatus = 'active' | 'revoked' | 'expired';

/** Public DTO — never includes encrypted token fields. */
export type JiraConnectionDto = {
  id: string;
  user_id: string;
  cloud_id: string;
  site_url: string;
  account_email: string | null;
  scopes: string;
  status: JiraConnectionStatus;
  created_at: Date;
  updated_at: Date;
};

export type JiraConnectionRow = JiraConnectionDto & {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: Date | null;
};

export type UpsertJiraConnectionInput = {
  user_id: string;
  cloud_id: string;
  site_url: string;
  account_email?: string | null;
  refresh_token_enc: string;
  access_token_enc?: string | null;
  access_token_expires_at?: Date | null;
  scopes: string;
  status?: JiraConnectionStatus;
};

export type UpdateJiraConnectionTokensInput = {
  refresh_token_enc?: string;
  access_token_enc?: string | null;
  access_token_expires_at?: Date | null;
  status?: JiraConnectionStatus;
};

export type JiraCloudProject = {
  id: string;
  key: string;
  name: string;
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

export type AtlassianTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type AtlassianAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
};
