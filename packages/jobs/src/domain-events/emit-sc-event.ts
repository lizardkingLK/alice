import { randomUUID } from 'node:crypto';
import { enqueueWorkflowRun } from '../enqueue-workflow-run.js';
import {
  scDomainEventSchema,
  type ScDomainEvent,
  type ScDomainEventDraft,
} from './sc-events.js';

export type ScDomainEventHandler = (
  event: ScDomainEvent
) => void | Promise<void>;

export type EmitScDomainEventOptions = {
  /** When set, enqueue `workflow.run` for the Phase 4 orchestrator. */
  redisUrl?: string;
};

const subscribers = new Set<ScDomainEventHandler>();

/** Register an in-process subscriber (tests / future bridge). */
export function onScDomainEvent(handler: ScDomainEventHandler): () => void {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

/** Clear subscribers — for unit tests only. */
export function clearScDomainEventSubscribers(): void {
  subscribers.clear();
}

/**
 * Emit a normalized SC domain event after successful sync.
 * Logs + in-process subscribers; optionally enqueues `workflow.run`.
 */
export async function emitScDomainEvent(
  raw: ScDomainEventDraft & { eventId?: string; occurredAt?: string },
  options: EmitScDomainEventOptions = {}
): Promise<ScDomainEvent> {
  const event = scDomainEventSchema.parse({
    ...raw,
    eventId: raw.eventId ?? randomUUID(),
    occurredAt: raw.occurredAt ?? new Date().toISOString(),
  });

  console.log(
    JSON.stringify({
      msg: 'sc.domain.event',
      type: event.type,
      eventId: event.eventId,
      deliveryId: event.deliveryId,
      projectId: 'projectId' in event ? event.projectId : undefined,
      workItemId: 'workItemId' in event ? event.workItemId : undefined,
    })
  );

  await Promise.all(
    [...subscribers].map(async (handler) => {
      await handler(event);
    })
  );

  if (options.redisUrl) {
    const enqueued = await enqueueWorkflowRun(options.redisUrl, { event });
    console.log(
      JSON.stringify({
        msg: 'sc.domain.event.enqueued_workflow',
        eventId: event.eventId,
        jobId: enqueued.jobId,
        duplicate: enqueued.duplicate,
      })
    );
  }

  return event;
}
