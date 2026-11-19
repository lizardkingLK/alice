/**
 * Opt-in GI-656 PostgreSQL integration coverage.
 *
 * RUN_GI656_POSTGRES_TESTS=1 \
 * GI656_TEST_DATABASE_URL=postgresql://.../alice_test \
 * GI656_TEST_DATABASE_CONFIRM_URL=postgresql://.../alice_test \
 * pnpm --filter api test -- --run tests/notifications/gi656-postgres.live.test.ts
 *
 * Both URLs are validated before a Prisma client is constructed. Application
 * DATABASE_URL/DIRECT_URL values are deliberately ignored.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  EmailOutboxStatus,
  EmailTemplate,
  NotificationType,
  UserRole,
  WorkItemStatus,
  type PrismaClient,
} from '@repo/types/prisma';
import {
  gi656PostgresTestsEnabled,
  requireGi656PostgresTestUrl,
} from '../helpers/gi656-postgres-test-target';
import type { EmailTransport } from '../../src/lib/email/email-transport';
import { TEST_USER } from '../factories/user.fixture';

const liveEnabled = gi656PostgresTestsEnabled();
// Deliberately validate during collection, before beforeAll constructs a client.
const liveUrl = liveEnabled ? requireGi656PostgresTestUrl() : null;
const describeLive = liveEnabled ? describe : describe.skip;
const runId = randomUUID();

type Scenario = {
  ownerId: string;
  managerId: string;
  outsiderId: string;
  projectId: string;
  workItemId: string;
};

describeLive.sequential('GI-656 PostgreSQL integration', () => {
  let client: PrismaClient;
  let PrismaEmailOutboxRepository: (typeof import('../../src/routes/api/notifications/email-outbox.repository.js'))['PrismaEmailOutboxRepository'];
  let NotificationEmailReconciler: (typeof import('../../src/routes/api/notifications/notification-email-reconciler.js'))['NotificationEmailReconciler'];
  let EmailOutboxProcessor: (typeof import('../../src/routes/api/notifications/email-outbox-processor.js'))['EmailOutboxProcessor'];
  let PrismaWeeklyProjectReportStore: (typeof import('../../src/routes/api/notifications/weekly-project-report-generator.js'))['PrismaWeeklyProjectReportStore'];
  let notificationsRepository: InstanceType<
    (typeof import('../../src/routes/api/notifications/notifications.repository.js'))['NotificationsRepository']
  >;
  const userIds: string[] = [];
  const projectIds: string[] = [];

  const fakeTransport: EmailTransport & { sent: string[] } = {
    sent: [],
    async send(message) {
      this.sent.push(message.idempotencyKey);
    },
  };

  async function scenario(label: string): Promise<Scenario> {
    const ownerId = randomUUID();
    const managerId = randomUUID();
    const outsiderId = randomUUID();
    const projectId = randomUUID();
    const workItemId = randomUUID();
    userIds.push(ownerId, managerId, outsiderId);
    projectIds.push(projectId);
    await client.users.createMany({
      data: [
        {
          id: ownerId,
          email: `${runId}-${label}-owner@example.test`,
          name: `${TEST_USER.name} ${label} owner`,
          role: UserRole.member,
        },
        {
          id: managerId,
          email: `${runId}-${label}-manager@example.test`,
          name: `${label} manager`,
          role: UserRole.manager,
        },
        {
          id: outsiderId,
          email: `${runId}-${label}-outsider@example.test`,
          name: `${label} outsider`,
          role: UserRole.member,
        },
      ],
    });
    await client.projects.create({
      data: {
        id: projectId,
        name: `${label} project`,
        key: `G${runId.replaceAll('-', '').slice(0, 8)}${label}`.slice(0, 30),
        owner_id: ownerId,
      },
    });
    await client.project_members.create({
      data: { project_id: projectId, user_id: managerId },
    });
    await client.work_items.create({
      data: {
        id: workItemId,
        project_id: projectId,
        title: `${label} item`,
        slug: `${label}-item-${workItemId.slice(0, 8)}`,
        type: 'task',
        status: WorkItemStatus.New,
      },
    });
    return { ownerId, managerId, outsiderId, projectId, workItemId };
  }

  function assignmentEvent(workItemId: string) {
    return {
      version: 1 as const,
      template: EmailTemplate.work_item_assignment,
      payload: {
        actorName: 'GI-656 integration',
        workItemId,
        workItemTitle: 'Atomic notification',
      },
    };
  }

  async function createNotification(
    userId: string,
    workItemId: string,
    suffix: string
  ) {
    const notification = await client.notifications.create({
      data: {
        user_id: userId,
        type: NotificationType.assign,
        message: `GI-656 ${suffix}`,
        related_item_id: workItemId,
        dedupe_key: `${runId}:${suffix}:${randomUUID()}`,
      },
    });
    await client.notification_email_events.create({
      data: {
        notification_id: notification.id,
        created_at: new Date(Date.now() - 10 * 60 * 1000),
        ...assignmentEvent(workItemId),
      },
    });
    return notification;
  }

  beforeAll(async () => {
    const { createPrismaClient } = await import('@repo/db');
    client = createPrismaClient(liveUrl!);
    await client.$queryRaw`SELECT 1`;
    vi.doMock('../../src/lib/prisma', () => ({ prisma: client }));
    const { NotificationsRepository } =
      await import('../../src/routes/api/notifications/notifications.repository.js');
    notificationsRepository = new NotificationsRepository({} as never);
    ({ PrismaEmailOutboxRepository } =
      await import('../../src/routes/api/notifications/email-outbox.repository.js'));
    ({ NotificationEmailReconciler } =
      await import('../../src/routes/api/notifications/notification-email-reconciler.js'));
    ({ EmailOutboxProcessor } =
      await import('../../src/routes/api/notifications/email-outbox-processor.js'));
    ({ PrismaWeeklyProjectReportStore } =
      await import('../../src/routes/api/notifications/weekly-project-report-generator.js'));
  });

  afterAll(async () => {
    if (!client) return;
    await client.email_outbox.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await client.projects.deleteMany({ where: { id: { in: projectIds } } });
    await client.users.deleteMany({ where: { id: { in: userIds } } });
    await client.$disconnect();
  });

  it('persists notifications and immutable email events atomically', async () => {
    const data = await scenario('atomic');
    const [persisted] = await notificationsRepository.insertMany(
      [
        {
          user_id: data.ownerId,
          type: 'assign',
          message: 'Atomic pair',
          related_item_id: data.workItemId,
          read_status: false,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
      ],
      { emailEvents: [assignmentEvent(data.workItemId)] }
    );
    expect(
      await client.notifications.findUnique({
        where: { id: persisted!.id },
        include: { email_event: true },
      })
    ).toMatchObject({ id: persisted!.id, email_event: { version: 1 } });
  });

  it('rolls back the earlier event and notification when a later notification fails', async () => {
    const data = await scenario('rollback');
    const message = `Must roll back ${runId}`;
    await expect(
      notificationsRepository.insertMany(
        [
          {
            user_id: data.ownerId,
            type: 'assign',
            message,
            related_item_id: data.workItemId,
            read_status: false,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          {
            user_id: randomUUID(),
            type: 'assign',
            message: 'FK failure',
            read_status: false,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
        ],
        {
          emailEvents: [assignmentEvent(data.workItemId), undefined],
        }
      )
    ).rejects.toThrow();
    expect(await client.notifications.count({ where: { message } })).toBe(0);
  });

  it('reconciles a post-commit outbox failure and sends once through a fake transport', async () => {
    const data = await scenario('reconcile');
    const notification = await createNotification(
      data.ownerId,
      data.workItemId,
      'reconcile'
    );
    const failedOutboxWrite = vi
      .fn()
      .mockRejectedValue(new Error('post-commit'));
    await expect(failedOutboxWrite()).rejects.toThrow('post-commit');
    expect(
      await client.notifications.findUnique({ where: { id: notification.id } })
    ).not.toBeNull();

    const repository = new PrismaEmailOutboxRepository(client);
    const reconciler = new NotificationEmailReconciler(repository);
    const [first, second] = await Promise.all([
      reconciler.reconcile(new Date()),
      reconciler.reconcile(new Date()),
    ]);
    expect(first.recovered + second.recovered).toBeGreaterThanOrEqual(1);
    expect(
      await client.email_outbox.count({
        where: { notification_id: notification.id },
      })
    ).toBe(1);

    const processor = new EmailOutboxProcessor(
      repository,
      fakeTransport,
      {
        build: (item) => ({
          to: item.recipientEmail,
          subject: 'fake',
          text: 'fake',
          html: '<p>fake</p>',
          idempotencyKey: item.idempotencyKey,
        }),
      },
      { workerId: `${runId}-reconcile`, batchSize: 1 }
    );
    expect(await processor.processBatch()).toMatchObject({ sent: 1 });
    expect(
      fakeTransport.sent.filter((key) => key.includes(notification.id))
    ).toHaveLength(1);
  });

  it('uses SKIP LOCKED across workers and recovers an expired lease', async () => {
    const data = await scenario('leases');
    const repository = new PrismaEmailOutboxRepository(client);
    for (const suffix of ['lease-a', 'lease-b']) {
      const notification = await createNotification(
        data.ownerId,
        data.workItemId,
        suffix
      );
      await repository.createForNotification({
        notificationId: notification.id,
        template: EmailTemplate.work_item_assignment,
        payload: assignmentEvent(data.workItemId).payload,
      });
    }
    const now = new Date();
    const [a, b] = await Promise.all([
      repository.claimBatch({
        workerId: 'worker-a',
        limit: 1,
        now,
        leaseUntil: new Date(now.getTime() + 60_000),
      }),
      repository.claimBatch({
        workerId: 'worker-b',
        limit: 1,
        now,
        leaseUntil: new Date(now.getTime() + 60_000),
      }),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0]!.id).not.toBe(b[0]!.id);

    await client.email_outbox.update({
      where: { id: a[0]!.id },
      data: { locked_until: new Date(now.getTime() - 1) },
    });
    const recovered = await repository.claimBatch({
      workerId: 'worker-recovery',
      limit: 1,
      now,
      leaseUntil: new Date(now.getTime() + 60_000),
    });
    expect(recovered.map((item) => item.id)).toContain(a[0]!.id);
  });

  it('shares one canonical project/week snapshot across concurrent weekly runs', async () => {
    const data = await scenario('weekly');
    await client.notification_email_preferences.createMany({
      data: [data.ownerId, data.managerId].map((user_id) => ({
        user_id,
        weekly_reports_enabled: true,
      })),
    });
    await client.weekly_project_report_subscriptions.createMany({
      data: [data.ownerId, data.managerId].map((user_id) => ({
        user_id,
        project_id: data.projectId,
      })),
    });
    const store = new PrismaWeeklyProjectReportStore(client);
    const periodStart = new Date('2026-11-02T00:00:00.000Z');
    const periodEnd = new Date('2026-11-09T00:00:00.000Z');
    const base = {
      projectId: data.projectId,
      projectName: 'weekly project',
      periodStart: '2026-11-02',
      periodEnd: '2026-11-08',
      completedCount: 0,
      completedThisWeekCount: 0,
      pendingCount: 1,
      createdCount: 1,
      overdueCount: 0,
      progressPercent: 0,
      statusSummary: { New: 1 },
    };
    const candidates = [
      {
        projectId: data.projectId,
        projectName: 'weekly project',
        userId: data.ownerId,
        recipientEmail: `${runId}-weekly-owner@example.test`,
        recipientName: 'owner',
        timezone: 'UTC',
        weekday: 1,
        hour: 8,
      },
      {
        projectId: data.projectId,
        projectName: 'weekly project',
        userId: data.managerId,
        recipientEmail: `${runId}-weekly-manager@example.test`,
        recipientName: 'manager',
        timezone: 'UTC',
        weekday: 1,
        hour: 8,
      },
    ];
    const results = await Promise.all(
      candidates.map((candidate, index) =>
        store.persist({
          candidate,
          snapshot: { ...base, totalCount: index + 1 },
          periodStart,
          periodEnd,
        })
      )
    );
    expect(results[0]!.snapshot).toEqual(results[1]!.snapshot);
    const reports = await client.weekly_project_reports.findMany({
      where: { project_id: data.projectId, period_start: periodStart },
    });
    expect(reports).toHaveLength(2);
    expect(reports[0]!.snapshot).toEqual(reports[1]!.snapshot);
  });

  it('enforces recipient authorization and per-template preferences', async () => {
    const data = await scenario('policy');
    const repository = new PrismaEmailOutboxRepository(client);
    await client.notification_email_preferences.create({
      data: {
        user_id: data.ownerId,
        work_item_assignment_enabled: false,
      },
    });
    const disabled = await createNotification(
      data.ownerId,
      data.workItemId,
      'preference-disabled'
    );
    const unauthorized = await createNotification(
      data.outsiderId,
      data.workItemId,
      'unauthorized'
    );
    await repository.createForNotification({
      notificationId: disabled.id,
      template: EmailTemplate.work_item_assignment,
      payload: assignmentEvent(data.workItemId).payload,
    });
    await repository.createForNotification({
      notificationId: unauthorized.id,
      template: EmailTemplate.work_item_assignment,
      payload: assignmentEvent(data.workItemId).payload,
    });
    const rows = await client.email_outbox.findMany({
      where: { notification_id: { in: [disabled.id, unauthorized.id] } },
      orderBy: { notification_id: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(
      rows.every((row) => row.status === EmailOutboxStatus.cancelled)
    ).toBe(true);
    expect(rows.map((row) => row.last_error_code).sort()).toEqual([
      'email_preference_disabled',
      'recipient_not_authorized',
    ]);
  });
});
