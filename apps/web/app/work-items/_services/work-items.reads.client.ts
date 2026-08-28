import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';

const workItemsPath = '/api/workItems';

export type ParentCandidateWorkItem = {
  id: string;
  title: string;
  type: string;
};

/** Parent picker options for create/edit forms (same project + allowed parent type). */
export async function listParentCandidateWorkItems(input: {
  projectId: string;
  parentType: string;
  excludeId?: string | null;
}): Promise<ParentCandidateWorkItem[]> {
  const params = new URLSearchParams({
    page: '1',
    limit: '100',
    projectId: input.projectId,
    type: input.parentType,
  });
  const result = await apiFetch<{ workItems: ParentCandidateWorkItem[] }>(
    `${workItemsPath}?${params.toString()}`
  );

  return (result.workItems ?? []).filter(
    (item) => !input.excludeId || item.id !== input.excludeId
  );
}

export async function countWorkItemDescendants(id: string): Promise<number> {
  const data = await apiFetch<{ descendantCount: number }>(
    `${workItemsPath}/${id}/descendant-count`
  );
  return data.descendantCount;
}

export interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface LinkedGithubPR {
  id: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  status: 'open' | 'merged' | 'closed';
  branch_name: string | null;
  commits: GithubCommit[];
}

export async function getLinkedPRs(
  workItemId: string
): Promise<{ prs: LinkedGithubPR[]; githubRepo: string | null }> {
  const res = await apiFetch<{
    prs: LinkedGithubPR[];
    githubRepo: string | null;
  }>(`${workItemsPath}/${workItemId}/github`);
  return { prs: res.prs || [], githubRepo: res.githubRepo || null };
}
