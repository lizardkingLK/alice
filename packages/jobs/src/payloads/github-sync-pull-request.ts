import { z } from 'zod';

export const githubPrSyncStatusSchema = z.enum(['open', 'closed', 'merged']);

export type GithubPrSyncStatus = z.infer<typeof githubPrSyncStatusSchema>;

/** Payload for `github.sync.pull_request`. */
export const githubSyncPullRequestPayloadSchema = z.object({
  deliveryId: z.string().min(1),
  installationId: z.number().int().positive(),
  action: z.string().min(1),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  prNumber: z.number().int().positive(),
  prTitle: z.string().min(1),
  prUrl: z.string().min(1),
  branchName: z.string().nullable(),
  status: githubPrSyncStatusSchema,
  receivedAt: z.string().min(1),
});

export type GithubSyncPullRequestPayload = z.infer<
  typeof githubSyncPullRequestPayloadSchema
>;

export function githubSyncPullRequestJobId(deliveryId: string): string {
  return `github-sync-pr-${deliveryId}`;
}
