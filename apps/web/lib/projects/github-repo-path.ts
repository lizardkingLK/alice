export type GithubRepoParts = {
  owner: string;
  repoName: string;
};

/** Split `owner/repo` or full GitHub URL into parts; empty / malformed → empty strings. */
export function parseGithubRepoPath(
  githubRepo: string | null | undefined
): GithubRepoParts {
  if (!githubRepo) {
    return { owner: '', repoName: '' };
  }

  let cleaned = githubRepo.trim();
  if (!cleaned) {
    return { owner: '', repoName: '' };
  }

  // Handle git@github.com:owner/repo.git
  if (cleaned.startsWith('git@github.com:')) {
    cleaned = cleaned.slice('git@github.com:'.length);
  }

  // Remove protocol and domain prefixes if present
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^(www\.)?github\.com\//i, '');

  // Strip query strings, hash fragments, trailing .git, and trailing slashes
  cleaned = cleaned.split('?')[0]?.split('#')[0] ?? cleaned;
  cleaned = cleaned.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/\/$/, '');

  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const owner = parts[0]!.trim();
    const repoName = parts[1]!.replace(/\.git$/i, '').trim();
    return { owner, repoName };
  }

  if (parts.length === 1) {
    return { owner: parts[0]!.trim(), repoName: '' };
  }

  return { owner: '', repoName: '' };
}

/** Join owner + repo into `owner/repo`, or `null` when either side is blank. */
export function formatGithubRepoPath(
  owner: string,
  repoName: string
): string | null {
  const trimmedOwner = owner.trim();
  const trimmedRepo = repoName.trim();

  if (!trimmedOwner && !trimmedRepo) {
    return null;
  }

  if (trimmedOwner.includes('/')) {
    const parsed = parseGithubRepoPath(trimmedOwner);
    if (!parsed.owner || !parsed.repoName) {
      return null;
    }
    return `${parsed.owner}/${parsed.repoName}`;
  }

  if (!trimmedOwner || !trimmedRepo) {
    return null;
  }

  return `${trimmedOwner}/${trimmedRepo}`;
}


