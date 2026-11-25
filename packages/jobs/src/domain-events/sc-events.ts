import { z } from 'zod';
import { SC_DOMAIN_EVENT_TYPES } from './sc-event-types.js';

const scEventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.string().min(1),
  deliveryId: z.string().min(1),
  installationId: z.number().int().positive(),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  projectId: z.string().min(1).optional(),
  workItemId: z.string().min(1).nullable().optional(),
});

export const pullRequestOpenedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.pullRequestOpened),
  prNumber: z.number().int().positive(),
  prId: z.string().min(1).optional(),
  prTitle: z.string().min(1),
  prUrl: z.string().min(1),
  branchName: z.string().nullable(),
  status: z.enum(['open', 'closed', 'merged']),
});

export const pullRequestUpdatedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.pullRequestUpdated),
  prNumber: z.number().int().positive(),
  prId: z.string().min(1).optional(),
  prTitle: z.string().min(1),
  prUrl: z.string().min(1),
  branchName: z.string().nullable(),
  status: z.enum(['open', 'closed', 'merged']),
});

export const pullRequestClosedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.pullRequestClosed),
  prNumber: z.number().int().positive(),
  prId: z.string().min(1).optional(),
  prTitle: z.string().min(1),
  prUrl: z.string().min(1),
  branchName: z.string().nullable(),
  status: z.literal('closed'),
});

export const pullRequestMergedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.pullRequestMerged),
  prNumber: z.number().int().positive(),
  prId: z.string().min(1).optional(),
  prTitle: z.string().min(1),
  prUrl: z.string().min(1),
  branchName: z.string().nullable(),
  status: z.literal('merged'),
});

export const pushReceivedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.pushReceived),
  branchName: z.string().min(1),
  beforeSha: z.string().nullable(),
  afterSha: z.string().nullable(),
  created: z.boolean(),
  deleted: z.boolean(),
  commitCount: z.number().int().nonnegative(),
  branchId: z.string().min(1).optional(),
});

export const branchCreatedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.branchCreated),
  branchName: z.string().min(1),
  headSha: z.string().nullable(),
  branchId: z.string().min(1).optional(),
});

export const branchUpdatedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.branchUpdated),
  branchName: z.string().min(1),
  headSha: z.string().nullable(),
  branchId: z.string().min(1).optional(),
});

export const branchDeletedEventSchema = scEventEnvelopeSchema.extend({
  type: z.literal(SC_DOMAIN_EVENT_TYPES.branchDeleted),
  branchName: z.string().min(1),
  headSha: z.string().nullable(),
  branchId: z.string().min(1).optional(),
});

export const scDomainEventSchema = z.discriminatedUnion('type', [
  pullRequestOpenedEventSchema,
  pullRequestUpdatedEventSchema,
  pullRequestClosedEventSchema,
  pullRequestMergedEventSchema,
  pushReceivedEventSchema,
  branchCreatedEventSchema,
  branchUpdatedEventSchema,
  branchDeletedEventSchema,
]);

export type ScDomainEvent = z.infer<typeof scDomainEventSchema>;
export type PullRequestOpenedEvent = z.infer<
  typeof pullRequestOpenedEventSchema
>;
export type PushReceivedEvent = z.infer<typeof pushReceivedEventSchema>;

/** Distributive omit so PR/push/branch drafts keep their discriminant fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type ScDomainEventDraft = DistributiveOmit<
  ScDomainEvent,
  'eventId' | 'occurredAt'
>;
