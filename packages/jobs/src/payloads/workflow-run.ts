import { z } from 'zod';
import { scDomainEventSchema } from '../domain-events/sc-events.js';

/** Payload for `workflow.run` — wraps a normalized SC domain event. */
export const workflowRunPayloadSchema = z.object({
  event: scDomainEventSchema,
});

export type WorkflowRunPayload = z.infer<typeof workflowRunPayloadSchema>;

export function workflowRunJobId(eventId: string): string {
  return `workflow-run-${eventId}`;
}
