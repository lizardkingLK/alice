vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { describe, expect, it, vi } from 'vitest';
import {
  WeeklyProjectReportGenerator,
  PrismaWeeklyProjectReportStore,
  isWeeklyReportDue,
  previousUtcWeek,
  type WeeklyProjectReportStore,
  type WeeklyReportCandidate,
  type WeeklyProjectSnapshot,
} from '../../src/routes/api/notifications/weekly-project-report-generator';

const now = new Date('2026-11-16T08:30:00.000Z');
const candidate = (userId: string): WeeklyReportCandidate => ({
  projectId: 'project-1',
  projectName: 'Apollo',
  userId,
  recipientEmail: `${userId}@example.com`,
  recipientName: userId,
  timezone: 'UTC',
  weekday: 1,
  hour: 8,
});
const snapshot: WeeklyProjectSnapshot = {
  projectId: 'project-1',
  projectName: 'Apollo',
  periodStart: '2026-11-09',
  periodEnd: '2026-11-15',
  totalCount: 10,
  completedCount: 4,
  completedThisWeekCount: 2,
  pendingCount: 6,
  createdCount: 3,
  overdueCount: 1,
  progressPercent: 40,
  statusSummary: { Done: 4, InProgress: 2, ToDo: 4 },
};
const outboxRepository = () => ({
  createForNotification: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
});

describe('WeeklyProjectReportGenerator', () => {
  it('uses the previous complete UTC week and recipient local schedule', () => {
    expect(previousUtcWeek(now)).toEqual({
      periodStart: new Date('2026-11-09T00:00:00.000Z'),
      periodEnd: new Date('2026-11-16T00:00:00.000Z'),
    });
    expect(isWeeklyReportDue(candidate('owner'), now)).toBe(true);
    expect(
      isWeeklyReportDue(
        { ...candidate('owner'), timezone: 'Bad/Timezone' },
        now
      )
    ).toBe(false);
  });

  it('summarizes actual project work-item data', async () => {
    const client = {
      weekly_project_report_subscriptions: { findMany: vi.fn() },
      weekly_project_reports: { findFirst: vi.fn() },
      work_items: {
        findMany: vi.fn().mockResolvedValue([
          {
            status: 'Done',
            created_at: new Date('2026-11-10T10:00:00.000Z'),
            done_at: new Date('2026-11-12T10:00:00.000Z'),
            due_date: new Date('2026-11-11T00:00:00.000Z'),
          },
          {
            status: 'InProgress',
            created_at: new Date('2026-10-01T10:00:00.000Z'),
            done_at: null,
            due_date: new Date('2026-11-15T00:00:00.000Z'),
          },
          {
            status: 'ToDo',
            created_at: new Date('2026-11-14T10:00:00.000Z'),
            done_at: null,
            due_date: null,
          },
        ]),
      },
      $transaction: vi.fn(),
    };
    const store = new PrismaWeeklyProjectReportStore(client as never);

    await expect(
      store.buildSnapshot({
        projectId: 'project-1',
        projectName: 'Apollo',
        periodStart: new Date('2026-11-09T00:00:00.000Z'),
        periodEnd: new Date('2026-11-16T00:00:00.000Z'),
        now,
      })
    ).resolves.toMatchObject({
      totalCount: 3,
      completedCount: 1,
      completedThisWeekCount: 1,
      pendingCount: 2,
      createdCount: 2,
      overdueCount: 1,
      progressPercent: 33,
      statusSummary: { Done: 1, InProgress: 1, ToDo: 1 },
    });
  });

  it('builds one consistent snapshot per project and counts duplicates', async () => {
    const store = {
      findCandidates: vi
        .fn()
        .mockResolvedValue([candidate('owner'), candidate('manager')]),
      findSnapshot: vi.fn().mockResolvedValue(null),
      buildSnapshot: vi.fn().mockResolvedValue(snapshot),
      persist: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'created',
          snapshot,
          notificationId: 'notification-1',
          eventPayload: {},
        })
        .mockResolvedValueOnce({ status: 'duplicate', snapshot }),
    } satisfies WeeklyProjectReportStore;

    await expect(
      new WeeklyProjectReportGenerator(store, outboxRepository()).generate(now)
    ).resolves.toEqual({
      candidates: 2,
      projects: 1,
      created: 1,
      duplicates: 1,
      failed: 0,
      outboxFailed: 0,
    });
    expect(store.buildSnapshot).toHaveBeenCalledOnce();
    expect(store.persist.mock.calls[0]?.[0].snapshot).toBe(
      store.persist.mock.calls[1]?.[0].snapshot
    );
  });

  it('isolates failures so another recipient can recover independently', async () => {
    const store = {
      findCandidates: vi
        .fn()
        .mockResolvedValue([candidate('owner'), candidate('manager')]),
      findSnapshot: vi.fn().mockResolvedValue(null),
      buildSnapshot: vi.fn().mockResolvedValue(snapshot),
      persist: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary database failure'))
        .mockResolvedValueOnce({
          status: 'created',
          snapshot,
          notificationId: 'notification-2',
          eventPayload: {},
        }),
    } satisfies WeeklyProjectReportStore;

    await expect(
      new WeeklyProjectReportGenerator(store, outboxRepository()).generate(now)
    ).resolves.toMatchObject({
      created: 1,
      failed: 1,
    });
    expect(store.persist).toHaveBeenCalledTimes(2);
  });

  it('keeps a committed report when post-commit outbox creation fails', async () => {
    const store = {
      findCandidates: vi.fn().mockResolvedValue([candidate('owner')]),
      findSnapshot: vi.fn().mockResolvedValue(null),
      buildSnapshot: vi.fn().mockResolvedValue(snapshot),
      persist: vi.fn().mockResolvedValue({
        status: 'created',
        snapshot,
        notificationId: 'notification-1',
        eventPayload: { projectId: 'project-1' },
      }),
    } satisfies WeeklyProjectReportStore;
    const outbox = {
      createForNotification: vi
        .fn()
        .mockRejectedValue(new Error('outbox down')),
    };

    await expect(
      new WeeklyProjectReportGenerator(store, outbox).generate(now)
    ).resolves.toMatchObject({
      created: 1,
      failed: 0,
      outboxFailed: 1,
    });
    expect(store.persist).toHaveBeenCalledOnce();
  });

  it('uses a database advisory lock and an existing canonical snapshot', async () => {
    const canonical = { ...snapshot, completedCount: 5, progressPercent: 50 };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      weekly_project_reports: {
        findFirst: vi.fn().mockResolvedValue({ snapshot: canonical }),
        create: vi.fn().mockResolvedValue({}),
      },
      notifications: {
        create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
      },
      notification_email_events: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const client = {
      weekly_project_report_subscriptions: { findMany: vi.fn() },
      weekly_project_reports: { findFirst: vi.fn() },
      work_items: { findMany: vi.fn() },
      $transaction: vi.fn(async (run) => await run(tx)),
    };

    await expect(
      new PrismaWeeklyProjectReportStore(client as never).persist({
        candidate: candidate('owner'),
        snapshot,
        periodStart: new Date('2026-11-09T00:00:00.000Z'),
        periodEnd: new Date('2026-11-16T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({ status: 'created', snapshot: canonical });
    expect(tx.$queryRaw).toHaveBeenCalledBefore(
      tx.weekly_project_reports.findFirst
    );
    expect(tx.weekly_project_reports.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ snapshot: canonical }),
      })
    );
    expect(tx).not.toHaveProperty('email_outbox');
  });

  it('prevents duplicate reports across concurrent generator runs', async () => {
    let canonical: WeeklyProjectSnapshot | null = null;
    let created = false;
    const persist = vi.fn(
      async (input: Parameters<WeeklyProjectReportStore['persist']>[0]) => {
        canonical ??= input.snapshot;
        if (created)
          return { status: 'duplicate' as const, snapshot: canonical };
        created = true;
        return {
          status: 'created' as const,
          snapshot: canonical,
          notificationId: 'notification-1',
          eventPayload: { projectId: 'project-1' },
        };
      }
    );
    const store = {
      findCandidates: vi.fn().mockResolvedValue([candidate('owner')]),
      findSnapshot: vi.fn().mockResolvedValue(null),
      buildSnapshot: vi
        .fn()
        .mockResolvedValueOnce(snapshot)
        .mockResolvedValueOnce({ ...snapshot, completedCount: 9 }),
      persist,
    } satisfies WeeklyProjectReportStore;
    const outbox = outboxRepository();

    const results = await Promise.all([
      new WeeklyProjectReportGenerator(store, outbox).generate(now),
      new WeeklyProjectReportGenerator(store, outbox).generate(now),
    ]);

    expect(results.reduce((sum, result) => sum + result.created, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.duplicates, 0)).toBe(1);
    expect(outbox.createForNotification).toHaveBeenCalledOnce();
    expect(persist.mock.results.map((result) => result.value)).toHaveLength(2);
  });

  it('skips recipients before their configured local delivery hour', async () => {
    const store = {
      findCandidates: vi
        .fn()
        .mockResolvedValue([{ ...candidate('owner'), hour: 9 }]),
      findSnapshot: vi.fn().mockResolvedValue(null),
      buildSnapshot: vi.fn(),
      persist: vi.fn(),
    } satisfies WeeklyProjectReportStore;

    await expect(
      new WeeklyProjectReportGenerator(store, outboxRepository()).generate(now)
    ).resolves.toEqual({
      candidates: 0,
      projects: 0,
      created: 0,
      duplicates: 0,
      failed: 0,
      outboxFailed: 0,
    });
    expect(store.buildSnapshot).not.toHaveBeenCalled();
  });
});
