import { z } from 'zod';

const vendorGithub = z.literal('github');

/** `projects.vc_external` when linked to GitHub. */
export const projectVcExternalSchema = z.object({
  vendor: vendorGithub,
  repo: z.string().min(1),
});

export type ProjectVcExternal = z.infer<typeof projectVcExternalSchema>;

export function buildGithubProjectVcExternal(repo: string): ProjectVcExternal {
  return projectVcExternalSchema.parse({
    vendor: 'github',
    repo: repo.trim(),
  });
}

export function tryParseProjectVcExternal(
  value: unknown
): ProjectVcExternal | null {
  const result = projectVcExternalSchema.safeParse(value ?? {});
  return result.success ? result.data : null;
}

export function githubRepoFromVcExternal(value: unknown): string | null {
  return tryParseProjectVcExternal(value)?.repo ?? null;
}

/** Map API/DTO `github_repo` into a persistable `vc_external` value. */
export function projectVcExternalFromGithubRepo(
  githubRepo: string | null | undefined
): ProjectVcExternal | null {
  if (githubRepo == null || githubRepo.trim() === '') {
    return null;
  }
  return buildGithubProjectVcExternal(githubRepo);
}

/** Project row → wire DTO still exposing `github_*` field names. */
export function withGithubProjectDtoFields<
  T extends {
    vc_connection_id?: string | null;
    vc_external?: unknown;
  },
>(
  row: T
): T & {
  github_repo: string | null;
  github_connection_id: string | null;
  has_github_token: boolean;
} {
  return {
    ...row,
    github_repo: githubRepoFromVcExternal(row.vc_external),
    github_connection_id: row.vc_connection_id ?? null,
    has_github_token: Boolean(row.vc_connection_id),
  };
}
