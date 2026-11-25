import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn();
const update = vi.fn();

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    job_runs: {
      upsert: (...args: unknown[]) => upsert(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { handleWorkflowRun } from '../src/jobs/workflow-run';
import { SC_DOMAIN_EVENT_TYPES } from '@repo/jobs';

describe('handleWorkflowRun', () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ id: 'run-1' });
    update.mockReset().mockResolvedValue({});
  });

  it('persists job_runs and parks at awaiting_human', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleWorkflowRun(
      {
        event: {
          eventId: 'evt-1',
          occurredAt: '2026-01-01T00:00:00.000Z',
          type: SC_DOMAIN_EVENT_TYPES.pushReceived,
          deliveryId: 'del-1',
          installationId: 9,
          repoOwner: 'acme',
          repoName: 'app',
          projectId: 'proj-1',
          workItemId: null,
          branchName: 'main',
          beforeSha: 'a',
          afterSha: 'b',
          created: false,
          deleted: false,
          commitCount: 1,
        },
      },
      'bull-1'
    );

    expect(upsert).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'awaiting_human' }),
      })
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
