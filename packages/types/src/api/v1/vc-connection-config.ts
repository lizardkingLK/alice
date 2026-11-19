import { z } from 'zod';
import type { GithubRepoOption } from './github-integration-types.js';

/** GitHub-shaped `provider_config` on `version_control_connections`. */
export const githubProviderConfigSchema = z.object({
  account_login: z.string().min(1),
  account_name: z.string().nullable().optional(),
  account_avatar_url: z.string().nullable().optional(),
  authorized_repo: z.string().nullable().optional(),
  repositories: z.array(z.unknown()).optional(),
});

export type GithubProviderConfig = z.infer<
  typeof githubProviderConfigSchema
> & {
  repositories?: GithubRepoOption[];
};

export function buildGithubProviderConfig(input: {
  account_login: string;
  account_name?: string | null;
  account_avatar_url?: string | null;
  authorized_repo?: string | null;
  repositories?: GithubRepoOption[];
}): GithubProviderConfig {
  return githubProviderConfigSchema.parse({
    account_login: input.account_login,
    account_name: input.account_name ?? null,
    account_avatar_url: input.account_avatar_url ?? null,
    authorized_repo: input.authorized_repo ?? null,
    repositories: input.repositories,
  }) as GithubProviderConfig;
}

export function tryParseGithubProviderConfig(
  value: unknown
): GithubProviderConfig | null {
  const result = githubProviderConfigSchema.safeParse(value ?? {});
  return result.success ? (result.data as GithubProviderConfig) : null;
}
