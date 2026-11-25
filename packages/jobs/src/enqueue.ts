import { Queue } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from './queues.js';
import { createRedisConnection } from './redis.js';

export type EnqueueJobResult = {
  jobId: string;
  duplicate: boolean;
};

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('already exists') ||
    (message.includes('job id') && message.includes('exists'))
  );
}

/**
 * Add a job to a BullMQ queue, then close the short-lived producer connection.
 * Duplicate `jobId` → `{ duplicate: true }` (idempotent callers).
 */
export async function enqueueJob(
  redisUrl: string,
  options: {
    queueName?: QueueName;
    name: string;
    data: unknown;
    jobId: string;
  }
): Promise<EnqueueJobResult> {
  const queueName = options.queueName ?? QUEUE_NAMES.default;
  const connection = createRedisConnection(redisUrl, 'producer');
  const queue = new Queue(queueName, { connection });

  try {
    const job = await queue.add(options.name, options.data, {
      jobId: options.jobId,
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
    return { jobId: job.id ?? options.jobId, duplicate: false };
  } catch (error) {
    if (isDuplicateJobError(error)) {
      return { jobId: options.jobId, duplicate: true };
    }
    throw error;
  } finally {
    await queue.close();
    connection.disconnect();
  }
}
