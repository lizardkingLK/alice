import {
  GithubConnectionStatusEnum,
  type GithubConnectionDto,
  type GithubConnectionStatus,
  type GithubRepoOption,
  type GithubRepoOwner,
  type GithubRepositoriesResponse,
  type GithubConnectionsResponse,
  type GithubOAuthStartResponse,
} from '@repo/types/api/v1';

export {
  GithubConnectionStatusEnum,
  type GithubConnectionDto,
  type GithubConnectionStatus,
  type GithubRepoOption,
  type GithubRepoOwner,
  type GithubRepositoriesResponse,
  type GithubConnectionsResponse,
  type GithubOAuthStartResponse,
};

export class GithubReauthorizationRequiredError extends Error {
  readonly code = 'GITHUB_REAUTHORIZATION_REQUIRED' as const;

  constructor(message = 'GitHub reauthorization is required.') {
    super(message);
    this.name = 'GithubReauthorizationRequiredError';
  }
}

export class GithubInsufficientScopeError extends Error {
  readonly code = 'GITHUB_INSUFFICIENT_SCOPE' as const;

  constructor(message = 'GitHub connection lacks required scopes.') {
    super(message);
    this.name = 'GithubInsufficientScopeError';
  }
}

export interface GithubTokenResponse {
  access_token: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GithubUserResponse {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export interface GithubAppMetadataResponse {
  id: number;
  slug: string;
  name?: string;
  html_url?: string;
}

export interface GithubInstallationAccount {
  id: number;
  login: string;
  avatar_url?: string | null;
  type: 'User' | 'Organization';
  name?: string | null;
}

export interface GithubInstallationResponse {
  id: number;
  account: GithubInstallationAccount | null;
  app_id?: number;
  target_type?: string | null;
  permissions?: Record<string, string>;
}

export interface GithubInstallationAccessTokenResponse {
  token: string;
  expires_at: string;
  permissions?: Record<string, string>;
  repository_selection?: string;
}

export interface GithubInstallationRepositoriesResponse {
  total_count: number;
  repositories: GithubApiRepoResponse[];
}

export interface GithubApiRepoResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
  private: boolean;
  html_url: string;
  default_branch?: string;
  description?: string | null;
}

export type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
};

export interface GithubOAuthConfigStored {
  [key: string]: unknown;
  kind: 'github_oauth';
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  account_login?: string;
  account_id?: string | number;
  account_name?: string;
  account_avatar_url?: string;
  authorized_repo?: string | null;
  repositories?: GithubRepoOption[];
}
