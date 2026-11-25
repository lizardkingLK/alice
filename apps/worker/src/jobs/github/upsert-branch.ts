import type { GithubSyncBranchAction } from '@repo/jobs';
import { prisma } from '../../lib/prisma';

export async function upsertSyncedBranch(input: {
  projectId: string;
  workItemId: string | null;
  repoOwner: string;
  repoName: string;
  branchName: string;
  headSha: string | null;
  action: GithubSyncBranchAction;
}): Promise<{ id: string }> {
  const deletedAt = input.action === 'delete' ? new Date() : null;

  const row = await prisma.version_control_branches.upsert({
    where: {
      project_id_vendor_repo_owner_repo_name_name: {
        project_id: input.projectId,
        vendor: 'github',
        repo_owner: input.repoOwner,
        repo_name: input.repoName,
        name: input.branchName,
      },
    },
    create: {
      project_id: input.projectId,
      work_item_id: input.workItemId,
      vendor: 'github',
      repo_owner: input.repoOwner,
      repo_name: input.repoName,
      name: input.branchName,
      head_sha: input.headSha,
      deleted_at: deletedAt,
    },
    update: {
      work_item_id: input.workItemId ?? undefined,
      head_sha: input.headSha,
      deleted_at: deletedAt,
      updated_at: new Date(),
    },
    select: { id: true },
  });

  return row;
}
