import { z } from 'zod';
import {
  GithubAuthModeEnum,
  githubAuthModeSchema,
  githubAccountTypeSchema,
  type GithubAuthMode,
  type GithubAccountType,
  type GithubRepoOption,
} from './github-integration-types.js';

/** GitHub-shaped `provider_config` on `version_control_connections`. */
export const githubProviderConfigSchema = z
  .object({
    /**
     * Defaults to `oauth` so legacy rows without `auth_mode` still parse.
     * New App installs must set `app` and provide `installation_id`.
     */
    auth_mode: githubAuthModeSchema.default(GithubAuthModeEnum.oauth),
    account_login: z.string().min(1),
    account_name: z.string().nullable().optional(),
    account_avatar_url: z.string().nullable().optional(),
    account_type: githubAccountTypeSchema.nullable().optional(),
    installation_id: z.number().int().positive().nullable().optional(),
    authorized_repo: z.string().nullable().optional(),
    repositories: z.array(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.auth_mode === GithubAuthModeEnum.app &&
      value.installation_id == null
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'installation_id is required when auth_mode is app',
        path: ['installation_id'],
      });
    }
  });

export type GithubProviderConfig = z.infer<
  typeof githubProviderConfigSchema
> & {
  repositories?: GithubRepoOption[];
};

export function buildGithubProviderConfig(input: {
  auth_mode?: GithubAuthMode;
  account_login: string;
  account_name?: string | null;
  account_avatar_url?: string | null;
  account_type?: GithubAccountType | null;
  installation_id?: number | null;
  authorized_repo?: string | null;
  repositories?: GithubRepoOption[];
}): GithubProviderConfig {
  return githubProviderConfigSchema.parse({
    auth_mode: input.auth_mode ?? GithubAuthModeEnum.oauth,
    account_login: input.account_login,
    account_name: input.account_name ?? null,
    account_avatar_url: input.account_avatar_url ?? null,
    account_type: input.account_type ?? null,
    installation_id: input.installation_id ?? null,
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
