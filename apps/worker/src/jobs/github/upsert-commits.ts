import type { GithubSyncPushCommit } from '@repo/jobs';
import { prisma } from '../../lib/prisma';

export async function upsertSyncedCommits(input: {
  projectId: string;
  workItemId: string | null;
  repoOwner: string;
  repoName: string;
  branchName: string;
  commits: GithubSyncPushCommit[];
}): Promise<number> {
  if (input.commits.length === 0) {
    return 0;
  }

  const results = await Promise.all(
    input.commits.map(async (commit) => {
      await prisma.version_control_commits.upsert({
        where: {
          project_id_vendor_repo_owner_repo_name_sha: {
            project_id: input.projectId,
            vendor: 'github',
            repo_owner: input.repoOwner,
            repo_name: input.repoName,
            sha: commit.sha,
          },
        },
        create: {
          project_id: input.projectId,
          work_item_id: input.workItemId,
          vendor: 'github',
          repo_owner: input.repoOwner,
          repo_name: input.repoName,
          sha: commit.sha,
          message: commit.message,
          author_login: commit.authorLogin,
          author_name: commit.authorName,
          author_email: commit.authorEmail,
          committed_at: commit.committedAt
            ? new Date(commit.committedAt)
            : null,
          html_url: commit.htmlUrl,
          branch_name: input.branchName,
        },
        update: {
          work_item_id: input.workItemId ?? undefined,
          message: commit.message,
          author_login: commit.authorLogin,
          author_name: commit.authorName,
          author_email: commit.authorEmail,
          committed_at: commit.committedAt
            ? new Date(commit.committedAt)
            : null,
          html_url: commit.htmlUrl,
          branch_name: input.branchName,
          updated_at: new Date(),
        },
      });
      return 1;
    })
  );

  return results.length;
}
