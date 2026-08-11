import { env } from '../../../config/env';
import { GitHubRepository, type GitHubSettingsRow } from './github.repository';

export type GitHubPullRequestResponse = {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at: string;
  body: string | null;
  draft: boolean;
  headBranch?: string;
  headSha?: string;
};

export type GitHubSettingsResponse = {
  github_owner: string | null;
  github_repo: string | null;
  has_token: boolean;
};

interface GitHubApiBranch {
  name: string;
}

interface GitHubApiCommit {
  sha?: string;
  commit?: {
    message?: string;
  };
}

interface GitHubCheckRun {
  conclusion: string | null;
  status: string;
}

interface GitHubCommitStatus {
  state: string;
  statuses?: { state: string }[];
}

interface GitHubDeployment {
  id: number;
}

export type GitHubBuildsStatus = 'success' | 'failure' | 'pending' | 'none';

export type GitHubWorkItemDevelopmentResponse = {
  github_owner: string | null;
  github_repo: string | null;
  branchesCount: number;
  commitsCount: number;
  pullRequestsCount: number;
  pullRequestLatestState: 'open' | 'closed' | 'merged' | 'none';
  buildsStatus: GitHubBuildsStatus;
  releasesStatus: 'success' | 'none';
  linkedPRs: GitHubPullRequestResponse[];
};

interface GitHubApiPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at: string;
  body?: string | null;
  draft?: boolean;
  merged_at?: string | null;
  head?: {
    ref: string;
    sha: string;
  };
}

export class GitHubService {
  constructor(private readonly githubRepository: GitHubRepository) {}

  private getHeaders(projectToken: string | null): HeadersInit {
    const headers: Record<string, string> = {
      'User-Agent': 'alice-app',
      'Accept': 'application/vnd.github+json',
    };

    const token = projectToken || env.GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async getProjectConfig(projectId: string): Promise<GitHubSettingsRow> {
    const settings = await this.githubRepository.getProjectGitHubSettings(projectId);
    if (!settings?.github_owner || !settings?.github_repo) {
      throw new Error('GitHub repository is not configured for this project.');
    }
    return settings;
  }


  async getSettings(projectId: string): Promise<GitHubSettingsResponse> {
    const settings = await this.githubRepository.getProjectGitHubSettings(projectId);
    return {
      github_owner: settings?.github_owner ?? null,
      github_repo: settings?.github_repo ?? null,
      has_token: !!settings?.github_token,
    };
  }

  async saveSettings(
    projectId: string,
    settings: { github_owner?: string | null; github_repo?: string | null; github_token?: string | null }
  ): Promise<GitHubSettingsResponse> {
    const updated = await this.githubRepository.updateProjectGitHubSettings(projectId, settings);
    return {
      github_owner: updated.github_owner,
      github_repo: updated.github_repo,
      has_token: !!updated.github_token,
    };
  }

  async getWorkItemDevelopment(workItemId: string): Promise<GitHubWorkItemDevelopmentResponse | null> {
    const workItem = await this.githubRepository.getWorkItemWithProject(workItemId);
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const settings = await this.githubRepository.getProjectGitHubSettings(workItem.project_id);
    if (!settings?.github_owner || !settings?.github_repo) {
      return null;
    }

    const owner = settings.github_owner;
    const repo = settings.github_repo;
    const key = workItem.jira_issue_key?.trim() || workItem.id.slice(0, 8).toUpperCase();
    const headers = this.getHeaders(settings.github_token);

    // 1. Fetch Pull Requests first to get branch/commit contexts
    const prsResult = await this.fetchPullRequests(owner, repo, key, workItem.github_prs, headers);

    // 2. Extract branches from matched/linked PRs
    const prBranches = prsResult.matched.map((pr) => pr.headBranch).filter(Boolean) as string[];

    // 3. Fetch commits of the matched/linked PRs to count them
    const prCommitShas = new Set<string>();
    await Promise.all(
      prsResult.matched.map(async (pr) => {
        try {
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/commits`,
            { headers }
          );
          const prCommits = response.ok ? await response.json() : [];
          if (Array.isArray(prCommits)) {
            (prCommits as GitHubApiCommit[]).forEach((c) => {
              if (c.sha) prCommitShas.add(c.sha);
            });
          }
        } catch (e) {
          console.error(`Failed to fetch commits for PR #${pr.number}:`, e);
        }
      })
    );

    // 4. Fetch branches and commits count using these context items
    const [
      branchesCount,
      commitsCount,
      releasesStatus,
    ] = await Promise.all([
      this.fetchBranchesCount(owner, repo, key, prBranches, headers),
      this.fetchCommitsCount(owner, repo, key, prCommitShas, headers),
      this.fetchReleasesStatus(owner, repo, headers),
    ]);

    const buildsStatus = await this.fetchBuildsStatus(
      owner,
      repo,
      prsResult.latestSha,
      headers
    );

    return {
      github_owner: owner,
      github_repo: repo,
      branchesCount,
      commitsCount,
      pullRequestsCount: prsResult.count,
      pullRequestLatestState: prsResult.latestState,
      buildsStatus,
      releasesStatus,
      linkedPRs: prsResult.matched,
    };
  }

  private async fetchBranchesCount(
    owner: string,
    repo: string,
    key: string,
    prBranches: string[],
    headers: HeadersInit
  ): Promise<number> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        { headers }
      );
      const branches = response.ok ? await response.json() : [];
      if (Array.isArray(branches)) {
        const matched = (branches as GitHubApiBranch[]).filter((b) => {
          const nameLower = b.name.toLowerCase();
          const matchesKey = nameLower.includes(key.toLowerCase());
          const matchesPrBranch = prBranches.some((prb) => prb.toLowerCase() === nameLower);
          return matchesKey || matchesPrBranch;
        });
        return Math.max(matched.length, prBranches.length);
      }
    } catch (e) {
      console.error('Failed to fetch branches from GitHub:', e);
    }
    return prBranches.length;
  }

  private async fetchCommitsCount(
    owner: string,
    repo: string,
    key: string,
    prCommitShas: Set<string>,
    headers: HeadersInit
  ): Promise<number> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
        { headers }
      );
      const commits = response.ok ? await response.json() : [];
      if (Array.isArray(commits)) {
        const matched = (commits as GitHubApiCommit[]).filter((c) => {
          const matchesKey = c.commit?.message?.toLowerCase().includes(key.toLowerCase());
          const matchesPrCommit = c.sha ? prCommitShas.has(c.sha) : false;
          return matchesKey || matchesPrCommit;
        });
        return Math.max(matched.length, prCommitShas.size);
      }
    } catch (e) {
      console.error('Failed to fetch commits from GitHub:', e);
    }
    return prCommitShas.size;
  }

  private async fetchPullRequests(
    owner: string,
    repo: string,
    key: string,
    githubPrs: unknown,
    headers: HeadersInit
  ): Promise<{
    count: number;
    latestState: 'open' | 'closed' | 'merged' | 'none';
    latestSha?: string;
    matched: GitHubPullRequestResponse[];
  }> {
    let pulls: GitHubApiPullRequest[] = [];
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
        { headers }
      );
      if (response.ok) {
        pulls = await response.json();
      }
    } catch (e) {
      console.error('Failed to fetch PRs from GitHub:', e);
    }

    const linkedPrNumbers: number[] = [];
    if (githubPrs) {
      const parsed = typeof githubPrs === 'string' ? JSON.parse(githubPrs) : githubPrs;
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          if (typeof p === 'number') {
            linkedPrNumbers.push(p);
          } else if (p && typeof p === 'object' && typeof p.number === 'number') {
            linkedPrNumbers.push(p.number as number);
          }
        });
      }
    }

    const matched = pulls.filter((pr) => {
      const isLinked = linkedPrNumbers.includes(pr.number);
      const hasTitle = pr.title.toLowerCase().includes(key.toLowerCase());
      const hasBody = pr.body?.toLowerCase().includes(key.toLowerCase());
      const hasBranch = pr.head?.ref?.toLowerCase().includes(key.toLowerCase());
      return isLinked || hasTitle || hasBody || hasBranch;
    });

    const mapped: GitHubPullRequestResponse[] = matched.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
      html_url: pr.html_url,
      updated_at: pr.updated_at,
      body: pr.body || null,
      draft: !!pr.draft,
      headBranch: pr.head?.ref,
      headSha: pr.head?.sha,
    }));

    return {
      count: mapped.length,
      latestState: (mapped[0]?.state as 'open' | 'closed' | 'merged' | 'none') || 'none',
      latestSha: matched[0]?.head?.sha,
      matched: mapped,
    };
  }

  private async fetchBuildsStatus(
    owner: string,
    repo: string,
    sha: string | undefined,
    headers: HeadersInit
  ): Promise<GitHubBuildsStatus> {
    if (!sha) return 'none';

    try {
      const buildsStatus = await this.fetchCheckRunsStatus(owner, repo, sha, headers);
      if (buildsStatus !== 'none') {
        return buildsStatus;
      }
      return await this.fetchCommitStatus(owner, repo, sha, headers);
    } catch (e) {
      console.error('Failed to fetch build status from GitHub:', e);
    }
    return 'none';
  }

  private async fetchCheckRunsStatus(
    owner: string,
    repo: string,
    sha: string,
    headers: HeadersInit
  ): Promise<GitHubBuildsStatus> {
    if (!/^[a-fA-F0-9]{40,64}$/.test(sha)) {
      console.warn(`Invalid commit SHA format for check-runs: ${sha}`);
      return 'none';
    }
    const safeSha = encodeURIComponent(sha);
    const checksResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${safeSha}/check-runs`,
      { headers }
    );
    const checks = checksResponse.ok ? await checksResponse.json() : null;
    if (checks && Array.isArray(checks.check_runs) && checks.check_runs.length > 0) {
      const hasFailure = (checks.check_runs as GitHubCheckRun[]).some(
        (run) => run.conclusion === 'failure' || run.conclusion === 'timed_out'
      );
      const hasPending = (checks.check_runs as GitHubCheckRun[]).some(
        (run) => run.status === 'queued' || run.status === 'in_progress'
      );
      if (hasFailure) return 'failure';
      if (hasPending) return 'pending';
      return 'success';
    }
    return 'none';
  }

  private async fetchCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    headers: HeadersInit
  ): Promise<GitHubBuildsStatus> {
    if (!/^[a-fA-F0-9]{40,64}$/.test(sha)) {
      console.warn(`Invalid commit SHA format for status: ${sha}`);
      return 'none';
    }
    const safeSha = encodeURIComponent(sha);
    const statusResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${safeSha}/status`,
      { headers }
    );
    const statusData = statusResponse.ok
      ? (await statusResponse.json() as GitHubCommitStatus)
      : null;
    if (statusData?.state && Array.isArray(statusData.statuses) && statusData.statuses.length > 0) {
      if (statusData.state === 'success') return 'success';
      if (statusData.state === 'failure' || statusData.state === 'error') return 'failure';
      return 'pending';
    }
    return 'none';
  }

  private async fetchReleasesStatus(
    owner: string,
    repo: string,
    headers: HeadersInit
  ): Promise<'success' | 'none'> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=5`,
        { headers }
      );
      const deployments = response.ok ? await response.json() : [];
      if (Array.isArray(deployments) && (deployments as GitHubDeployment[]).length > 0) {
        return 'success';
      }
    } catch (e) {
      console.error('Failed to fetch deployments from GitHub:', e);
    }
    return 'none';
  }
}
