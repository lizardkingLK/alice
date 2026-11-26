import { z } from 'zod';

export const githubSyncPushCommitSchema = z.object({
  sha: z.string().min(1),
  message: z.string(),
  authorLogin: z.string().nullable(),
  authorName: z.string().nullable(),
  authorEmail: z.string().nullable(),
  committedAt: z.string().nullable(),
  htmlUrl: z.string().nullable(),
});

export type GithubSyncPushCommit = z.infer<typeof githubSyncPushCommitSchema>;

/** Payload for `github.sync.push`. */
export const githubSyncPushPayloadSchema = z.object({
  deliveryId: z.string().min(1),
  installationId: z.number().int().positive(),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  ref: z.string().min(1),
  branchName: z.string().min(1),
  beforeSha: z.string().nullable(),
  afterSha: z.string().nullable(),
  created: z.boolean(),
  deleted: z.boolean(),
  commits: z.array(githubSyncPushCommitSchema),
  receivedAt: z.string().min(1),
});

export type GithubSyncPushPayload = z.infer<typeof githubSyncPushPayloadSchema>;

export function githubSyncPushJobId(deliveryId: string): string {
  return `github-sync-push-${deliveryId}`;
}
