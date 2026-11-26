import type { GithubSyncPullRequestPayload } from '@repo/jobs';
import { prisma } from '../../lib/prisma';

export type UpsertLinkedPrResult = {
  workItemId: string;
  prId: string;
  created: boolean;
};

export type LinkedPrRepo = {
  owner: string;
  name: string;
};

export async function upsertLinkedPullRequest(
  workItemId: string,
  payload: GithubSyncPullRequestPayload,
  repo?: LinkedPrRepo
): Promise<UpsertLinkedPrResult> {
  const owner = repo?.owner ?? payload.repoOwner;
  const name = repo?.name ?? payload.repoName;

  const existing = await prisma.version_control_pull_requests.findUnique({
    where: {
      work_item_id_vendor_repo_owner_repo_name_pr_number: {
        work_item_id: workItemId,
        vendor: 'github',
        repo_owner: owner,
        repo_name: name,
        pr_number: payload.prNumber,
      },
    },
    select: { id: true },
  });

  const row = await prisma.version_control_pull_requests.upsert({
    where: {
      work_item_id_vendor_repo_owner_repo_name_pr_number: {
        work_item_id: workItemId,
        vendor: 'github',
        repo_owner: owner,
        repo_name: name,
        pr_number: payload.prNumber,
      },
    },
    create: {
      work_item_id: workItemId,
      vendor: 'github',
      pr_number: payload.prNumber,
      repo_owner: owner,
      repo_name: name,
      pr_title: payload.prTitle,
      pr_url: payload.prUrl,
      branch_name: payload.branchName,
      status: payload.status,
    },
    update: {
      pr_title: payload.prTitle,
      pr_url: payload.prUrl,
      branch_name: payload.branchName,
      status: payload.status,
      updated_at: new Date(),
    },
    select: { id: true },
  });

  return {
    workItemId,
    prId: row.id,
    created: existing == null,
  };
}

/** Refresh every existing link for this GitHub PR (multi-work-item links). */
export async function refreshExistingLinkedPullRequests(
  payload: GithubSyncPullRequestPayload
): Promise<UpsertLinkedPrResult[]> {
  const existing = await prisma.version_control_pull_requests.findMany({
    where: {
      vendor: 'github',
      repo_owner: { equals: payload.repoOwner, mode: 'insensitive' },
      repo_name: { equals: payload.repoName, mode: 'insensitive' },
      pr_number: payload.prNumber,
    },
    select: {
      work_item_id: true,
      repo_owner: true,
      repo_name: true,
    },
  });

  return Promise.all(
    existing.map((row) =>
      upsertLinkedPullRequest(row.work_item_id, payload, {
        owner: row.repo_owner,
        name: row.repo_name,
      })
    )
  );
}
