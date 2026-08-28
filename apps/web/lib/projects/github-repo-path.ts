export type GithubRepoParts = {
  owner: string;
  repoName: string;
};

/** Split `owner/repo` into parts; empty / malformed → empty strings. */
export function parseGithubRepoPath(
  githubRepo: string | null | undefined
): GithubRepoParts {
  if (!githubRepo) {
    return { owner: '', repoName: '' };
  }
  const [owner = '', repoName = ''] = githubRepo.split('/');
  return { owner, repoName };
}

/** Join owner + repo into `owner/repo`, or `null` when either side is blank. */
export function formatGithubRepoPath(
  owner: string,
  repoName: string
): string | null {
  const trimmedOwner = owner.trim();
  const trimmedRepo = repoName.trim();
  if (!trimmedOwner || !trimmedRepo) {
    return null;
  }
  return `${trimmedOwner}/${trimmedRepo}`;
}
