import { z } from 'zod';

export const githubSyncBranchActionSchema = z.enum([
  'create',
  'delete',
  'update',
]);

export type GithubSyncBranchAction = z.infer<
  typeof githubSyncBranchActionSchema
>;

/** Payload for `github.sync.branch`. */
export const githubSyncBranchPayloadSchema = z.object({
  deliveryId: z.string().min(1),
  installationId: z.number().int().positive(),
  action: githubSyncBranchActionSchema,
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  branchName: z.string().min(1),
  headSha: z.string().nullable(),
  receivedAt: z.string().min(1),
});

export type GithubSyncBranchPayload = z.infer<
  typeof githubSyncBranchPayloadSchema
>;

export function githubSyncBranchJobId(deliveryId: string): string {
  return `github-sync-branch-${deliveryId}`;
}
