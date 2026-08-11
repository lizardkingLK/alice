import { apiFetch } from '@/lib/api/api-client';

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at: string;
  body: string | null;
  draft: boolean;
}

export interface GitHubSettings {
  github_owner: string | null;
  github_repo: string | null;
  has_token: boolean;
}

export async function fetchGitHubSettings(projectId: string): Promise<GitHubSettings> {
  const res = await apiFetch<{ data: GitHubSettings; error: string | null }>(
    `/api/github/settings/${projectId}`
  );
  if (res.error) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function saveGitHubSettings(
  projectId: string,
  settings: { github_owner: string | null; github_repo: string | null; github_token?: string | null }
): Promise<GitHubSettings> {
  const res = await apiFetch<{ data: GitHubSettings; error: string | null }>(
    `/api/github/settings/${projectId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    }
  );
  if (res.error) {
    throw new Error(res.error);
  }
  return res.data;
}

export interface GitHubWorkItemDevelopment {
  github_owner: string | null;
  github_repo: string | null;
  branchesCount: number;
  commitsCount: number;
  pullRequestsCount: number;
  pullRequestLatestState: 'open' | 'closed' | 'merged' | 'none';
  buildsStatus: 'success' | 'failure' | 'pending' | 'none';
  releasesStatus: 'success' | 'none';
  linkedPRs: GitHubPullRequest[];
}

export async function fetchWorkItemDevelopment(
  workItemId: string
): Promise<GitHubWorkItemDevelopment | null> {
  const res = await apiFetch<{ data: GitHubWorkItemDevelopment | null; error: string | null }>(
    `/api/github/work-items/${workItemId}/development`
  );
  if (res.error) {
    throw new Error(res.error);
  }
  return res.data;
}
