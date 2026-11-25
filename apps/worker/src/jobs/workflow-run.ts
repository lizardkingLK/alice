import {
  JOB_KINDS,
  workflowRunPayloadSchema,
  type WorkflowRunPayload,
} from '@repo/jobs';
import { prisma } from '../lib/prisma';

/**
 * Phase 4 MVP orchestrator: persist `job_runs`, mark HITL required, no agent tools yet.
 */
export async function handleWorkflowRun(
  data: WorkflowRunPayload,
  bullmqJobId?: string
): Promise<void> {
  const payload = workflowRunPayloadSchema.parse(data);
  const { event } = payload;
  const projectId =
    'projectId' in event && typeof event.projectId === 'string'
      ? event.projectId
      : null;

  const startedAt = new Date();
  const row = await prisma.job_runs.upsert({
    where: { event_id: event.eventId },
    create: {
      kind: JOB_KINDS.workflowRun,
      status: 'running',
      bullmq_job_id: bullmqJobId ?? null,
      event_id: event.eventId,
      event_type: event.type,
      delivery_id: event.deliveryId,
      project_id: projectId,
      payload: event,
      started_at: startedAt,
    },
    update: {
      status: 'running',
      bullmq_job_id: bullmqJobId ?? undefined,
      started_at: startedAt,
      error: null,
      updated_at: new Date(),
    },
    select: { id: true },
  });

  // HITL gate: no agent tools in MVP — park the run for future approval UI.
  await prisma.job_runs.update({
    where: { id: row.id },
    data: {
      status: 'awaiting_human',
      finished_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log(
    JSON.stringify({
      msg: 'workflow.run.hitl_required',
      jobRunId: row.id,
      eventId: event.eventId,
      eventType: event.type,
      deliveryId: event.deliveryId,
      projectId,
    })
  );
}
