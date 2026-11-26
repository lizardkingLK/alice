import { JOB_KINDS } from './job-kinds.js';
import { enqueueJob, type EnqueueJobResult } from './enqueue.js';
import {
  workflowRunJobId,
  workflowRunPayloadSchema,
  type WorkflowRunPayload,
} from './payloads/workflow-run.js';

export async function enqueueWorkflowRun(
  redisUrl: string,
  rawPayload: WorkflowRunPayload
): Promise<EnqueueJobResult> {
  const data = workflowRunPayloadSchema.parse(rawPayload);
  return enqueueJob(redisUrl, {
    name: JOB_KINDS.workflowRun,
    data,
    jobId: workflowRunJobId(data.event.eventId),
  });
}
