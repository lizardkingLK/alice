/** Re-export v1 wire schemas from @repo/types; local imports stay stable during migration. */
import type { CreateWorkItemBody } from '@repo/types/api/v1';

export {
  createWorkItemBodySchema,
  isBlockedPastDueDateChange,
  jsonSchema,
  linkWorkItemGithubPrBodySchema,
  patchWorkItemBodySchema,
  patchWorkItemStatusBodySchema,
  preprocessWorkItemMutationBody,
  workItemCoreObject,
  workItemLifecycleActionBodySchema,
  workItemStatusSchema,
  type CreateWorkItemBody,
  type PatchWorkItemBody,
  type PatchWorkItemStatusBody,
  type SupabaseJson,
  type WorkItemLifecycleActionBody,
  type WorkItemUpdateBody,
} from '@repo/types/api/v1';

export type WorkItemBody = CreateWorkItemBody;

export { toDateOnly } from '@repo/types';
