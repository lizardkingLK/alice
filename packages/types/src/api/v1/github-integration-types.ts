import { z } from 'zod';

export enum GithubConnectionStatusEnum {
  active = 'active',
  revoked = 'revoked',
  expired = 'expired',
}

export const githubConnectionStatusSchema = z.enum([
  GithubConnectionStatusEnum.active,
  GithubConnectionStatusEnum.revoked,
  GithubConnectionStatusEnum.expired,
]);
export type GithubConnectionStatus = z.infer<
  typeof githubConnectionStatusSchema
>;

export const githubRepoOwnerSchema = z.object({
  login: z.string(),
  avatar_url: z.string().optional(),
});
export type GithubRepoOwner = z.infer<typeof githubRepoOwnerSchema>;

export const githubRepoOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: githubRepoOwnerSchema,
  private: z.boolean(),
  html_url: z.string(),
  default_branch: z.string().optional(),
  description: z.string().nullable().optional(),
});
export type GithubRepoOption = z.infer<typeof githubRepoOptionSchema>;

export const githubConnectionDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: githubConnectionStatusSchema,
  account_login: z.string(),
  account_id: z.union([z.string(), z.number()]).optional(),
  account_name: z.string().optional(),
  account_avatar_url: z.string().optional(),
  scope: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  has_access_token: z.boolean(),
  has_refresh_token: z.boolean(),
  created_at: z.union([z.date(), z.string()]),
  updated_at: z.union([z.date(), z.string()]),
  authorized_repo: z.string().nullable().optional(),
  repositories: z.array(githubRepoOptionSchema).optional(),
  created_by_user_id: z.string().nullable().optional(),
  created_by_role: z.string().nullable().optional(),
  created_by_name: z.string().nullable().optional(),
  is_admin_owned: z.boolean().optional(),
  can_manage: z.boolean().optional(),
});
export type GithubConnectionDto = z.infer<typeof githubConnectionDtoSchema>;

export const githubConnectionsResponseSchema = z.object({
  connections: z.array(githubConnectionDtoSchema),
});
export type GithubConnectionsResponse = z.infer<
  typeof githubConnectionsResponseSchema
>;

export const githubRepositoriesResponseSchema = z.object({
  repositories: z.array(githubRepoOptionSchema),
});
export type GithubRepositoriesResponse = z.infer<
  typeof githubRepositoriesResponseSchema
>;

export const githubOAuthStartResponseSchema = z.object({
  url: z.string(),
});
export type GithubOAuthStartResponse = z.infer<
  typeof githubOAuthStartResponseSchema
>;

export enum WorkItemGithubConfigStatusEnum {
  connected = 'connected',
  missing = 'missing',
  invalid = 'invalid',
  stale = 'stale',
}

export const WORK_ITEM_GITHUB_CONFIG_STATUSES = [
  WorkItemGithubConfigStatusEnum.connected,
  WorkItemGithubConfigStatusEnum.missing,
  WorkItemGithubConfigStatusEnum.invalid,
  WorkItemGithubConfigStatusEnum.stale,
] as const;

export const workItemGithubConfigStatusSchema = z.enum(
  WORK_ITEM_GITHUB_CONFIG_STATUSES
);

export type WorkItemGithubConfigStatus = z.infer<
  typeof workItemGithubConfigStatusSchema
>;

export const WORK_ITEM_GITHUB_STATUS_MESSAGES: Record<
  WorkItemGithubConfigStatusEnum,
  string
> = {
  [WorkItemGithubConfigStatusEnum.connected]:
    'GitHub Integration is connected.',
  [WorkItemGithubConfigStatusEnum.missing]:
    'GitHub configuration is missing for this project.',
  [WorkItemGithubConfigStatusEnum.invalid]:
    'GitHub configuration is invalid. Please update the connection.',
  [WorkItemGithubConfigStatusEnum.stale]:
    'GitHub connection is stale or expired. Please re-authenticate.',
};
