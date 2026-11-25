import { Worker, type Job } from 'bullmq';
import {
  JOB_KINDS,
  QUEUE_NAMES,
  createRedisConnection,
  type GithubSyncPullRequestPayload,
  type GithubWebhookIngestPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import { handleGithubSyncPullRequest } from './github-sync-pull-request';
import { handleGithubWebhookIngest } from './github-webhook.ingest';

let defaultWorker: Worker | null = null;

async function processDefaultJob(job: Job): Promise<void> {
  if (job.name === JOB_KINDS.githubWebhookIngest) {
    await handleGithubWebhookIngest(job.data as GithubWebhookIngestPayload);
    return;
  }

  if (job.name === JOB_KINDS.githubSyncPullRequest) {
    await handleGithubSyncPullRequest(job.data as GithubSyncPullRequestPayload);
    return;
  }

  console.warn(
    JSON.stringify({
      msg: 'unknown.job.kind',
      name: job.name,
      id: job.id,
    })
  );
}

/**
 * Start BullMQ consumers when `REDIS_URL` is set. No-op otherwise so the
 * health HTTP server can still boot in environments without a queue.
 */
export function startWorkers(): void {
  if (!env.REDIS_URL) {
    console.log('info. REDIS_URL unset — BullMQ workers not started');
    return;
  }

  if (defaultWorker) {
    return;
  }

  const connection = createRedisConnection(env.REDIS_URL, 'worker');

  defaultWorker = new Worker(QUEUE_NAMES.default, processDefaultJob, {
    connection,
    concurrency: 5,
  });

  defaultWorker.on('failed', (job, error) => {
    console.error(
      JSON.stringify({
        msg: 'job.failed',
        queue: QUEUE_NAMES.default,
        name: job?.name,
        id: job?.id,
        error: error.message,
      })
    );
  });

  console.log(
    JSON.stringify({
      msg: 'bullmq.worker.started',
      queue: QUEUE_NAMES.default,
    })
  );
}
