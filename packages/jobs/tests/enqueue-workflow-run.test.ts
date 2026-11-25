import { describe, expect, it, vi } from 'vitest';

const enqueueJob = vi.fn();

vi.mock('../src/enqueue.js', () => ({
  enqueueJob: (...args: unknown[]) => enqueueJob(...args),
}));

import { JOB_KINDS } from '../src/job-kinds';
import { enqueueWorkflowRun } from '../src/enqueue-workflow-run';
import { SC_DOMAIN_EVENT_TYPES } from '../src/domain-events/sc-event-types';

describe('enqueueWorkflowRun', () => {
  it('enqueues workflow.run with a stable job id', async () => {
    enqueueJob.mockResolvedValue({
      jobId: 'workflow-run-evt-1',
      duplicate: false,
    });

    const result = await enqueueWorkflowRun('redis://localhost:6379', {
      event: {
        eventId: 'evt-1',
        occurredAt: '2026-01-01T00:00:00.000Z',
        type: SC_DOMAIN_EVENT_TYPES.branchCreated,
        deliveryId: 'd1',
        installationId: 1,
        repoOwner: 'acme',
        repoName: 'app',
        projectId: 'p1',
        workItemId: null,
        branchName: 'feat',
        headSha: null,
      },
    });

    expect(enqueueJob).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        name: JOB_KINDS.workflowRun,
        jobId: 'workflow-run-evt-1',
      })
    );
    expect(result.jobId).toBe('workflow-run-evt-1');
  });
});
