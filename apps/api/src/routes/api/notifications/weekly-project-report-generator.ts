import {
  EmailTemplate,
  NotificationType,
  Prisma,
  ProjectStatus,
  RecordStatus,
  UserMembershipStatus,
  UserRole,
  WorkItemStatus,
} from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';
import type { PrismaEmailOutboxRepository } from './email-outbox.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklyProjectSnapshot = {
  readonly projectId: string;
  readonly projectName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalCount: number;
  readonly completedCount: number;
  readonly completedThisWeekCount: number;
  readonly pendingCount: number;
  readonly createdCount: number;
  readonly overdueCount: number;
  readonly progressPercent: number;
  readonly statusSummary: Readonly<Record<string, number>>;
};

export type WeeklyReportCandidate = {
  readonly projectId: string;
  readonly projectName: string;
  readonly userId: string;
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly timezone: string;
  readonly weekday: number;
  readonly hour: number;
};

export interface WeeklyProjectReportStore {
  findCandidates(): Promise<readonly WeeklyReportCandidate[]>;
  findSnapshot(input: {
    projectId: string;
    periodStart: Date;
  }): Promise<WeeklyProjectSnapshot | null>;
  buildSnapshot(input: {
    projectId: string;
    projectName: string;
    periodStart: Date;
    periodEnd: Date;
    now: Date;
  }): Promise<WeeklyProjectSnapshot>;
  persist(input: {
    candidate: WeeklyReportCandidate;
    snapshot: WeeklyProjectSnapshot;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{
    status: 'created' | 'duplicate';
    snapshot: WeeklyProjectSnapshot;
    notificationId?: string;
    eventPayload?: Prisma.JsonObject;
  }>;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousUtcWeek(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const currentMonday = new Date(today.getTime() - daysSinceMonday * DAY_MS);
  return {
    periodStart: new Date(currentMonday.getTime() - 7 * DAY_MS),
    periodEnd: currentMonday,
  };
}

export function isWeeklyReportDue(
  candidate: Pick<WeeklyReportCandidate, 'timezone' | 'weekday' | 'hour'>,
  now: Date
): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: candidate.timezone,
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      parts.find((part) => part.type === 'weekday')?.value ?? ''
    );
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    return weekday === candidate.weekday && hour >= candidate.hour;
  } catch {
    return false;
  }
}

type WeeklyProjectPrismaClient = Pick<
  typeof prisma,
  | 'weekly_project_report_subscriptions'
  | 'weekly_project_reports'
  | 'work_items'
  | '$transaction'
>;

const weeklyProjectSnapshotSchema: z.ZodType<WeeklyProjectSnapshot> = z
  .object({
    projectId: z.string(),
    projectName: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    totalCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    completedThisWeekCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    createdCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    progressPercent: z.number().int().min(0).max(100),
    statusSummary: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();

export class PrismaWeeklyProjectReportStore implements WeeklyProjectReportStore {
  constructor(private readonly client: WeeklyProjectPrismaClient = prisma) {}

  async findCandidates(): Promise<readonly WeeklyReportCandidate[]> {
    const rows = await this.client.weekly_project_report_subscriptions.findMany(
      {
        where: {
          enabled: true,
          project: { status: ProjectStatus.active, deleted_at: null },
          user: {
            active: true,
            status: RecordStatus.active,
            membership_status: UserMembershipStatus.active,
            notification_email_preference: {
              is: { email_enabled: true, weekly_reports_enabled: true },
            },
          },
        },
        select: {
          project_id: true,
          project: { select: { name: true, owner_id: true } },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              project_memberships: {
                select: { project_id: true, status: true },
              },
              notification_email_preference: {
                select: {
                  timezone: true,
                  weekly_report_weekday: true,
                  weekly_report_hour: true,
                },
              },
            },
          },
        },
      }
    );

    return rows
      .filter((row) => {
        const isOwner = row.project.owner_id === row.user.id;
        const isManager =
          row.user.role === UserRole.manager &&
          row.user.project_memberships.some(
            (membership) =>
              membership.project_id === row.project_id &&
              membership.status === RecordStatus.active
          );
        return isOwner || isManager;
      })
      .map((row) => ({
        projectId: row.project_id,
        projectName: row.project.name,
        userId: row.user.id,
        recipientEmail: row.user.email,
        recipientName: row.user.name,
        timezone: row.user.notification_email_preference!.timezone,
        weekday: row.user.notification_email_preference!.weekly_report_weekday,
        hour: row.user.notification_email_preference!.weekly_report_hour,
      }));
  }

  async findSnapshot(input: {
    projectId: string;
    periodStart: Date;
  }): Promise<WeeklyProjectSnapshot | null> {
    const existing = await this.client.weekly_project_reports.findFirst({
      where: {
        project_id: input.projectId,
        period_start: input.periodStart,
      },
      orderBy: { created_at: 'asc' },
      select: { snapshot: true },
    });
    return existing
      ? weeklyProjectSnapshotSchema.parse(existing.snapshot)
      : null;
  }

  async buildSnapshot(input: {
    projectId: string;
    projectName: string;
    periodStart: Date;
    periodEnd: Date;
    now: Date;
  }): Promise<WeeklyProjectSnapshot> {
    const items = await this.client.work_items.findMany({
      where: {
        project_id: input.projectId,
        record_status: RecordStatus.active,
      },
      select: { status: true, created_at: true, done_at: true, due_date: true },
    });
    const statusSummary: Record<string, number> = {};
    for (const item of items) {
      statusSummary[item.status] = (statusSummary[item.status] ?? 0) + 1;
    }
    const completedCount = items.filter(
      (item) => item.status === WorkItemStatus.Done
    ).length;
    return {
      projectId: input.projectId,
      projectName: input.projectName,
      periodStart: dateOnly(input.periodStart),
      periodEnd: dateOnly(new Date(input.periodEnd.getTime() - DAY_MS)),
      totalCount: items.length,
      completedCount,
      completedThisWeekCount: items.filter(
        (item) =>
          item.done_at &&
          item.done_at >= input.periodStart &&
          item.done_at < input.periodEnd
      ).length,
      pendingCount: items.length - completedCount,
      createdCount: items.filter(
        (item) =>
          item.created_at >= input.periodStart &&
          item.created_at < input.periodEnd
      ).length,
      overdueCount: items.filter(
        (item) =>
          item.status !== WorkItemStatus.Done &&
          item.due_date !== null &&
          item.due_date < input.now
      ).length,
      progressPercent:
        items.length === 0
          ? 0
          : Math.round((completedCount / items.length) * 100),
      statusSummary,
    };
  }

  async persist(input: {
    candidate: WeeklyReportCandidate;
    snapshot: WeeklyProjectSnapshot;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{
    status: 'created' | 'duplicate';
    snapshot: WeeklyProjectSnapshot;
    notificationId?: string;
    eventPayload?: Prisma.JsonObject;
  }> {
    const eventId = `${input.candidate.projectId}-${input.candidate.userId}-${dateOnly(input.periodStart)}`;
    try {
      const persisted = await this.client.$transaction(async (tx) => {
        const lockKey = `${input.candidate.projectId}:${dateOnly(input.periodStart)}`;
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
        );
        const existing = await tx.weekly_project_reports.findFirst({
          where: {
            project_id: input.candidate.projectId,
            period_start: input.periodStart,
          },
          orderBy: { created_at: 'asc' },
          select: { snapshot: true },
        });
        const canonicalSnapshot = existing
          ? weeklyProjectSnapshotSchema.parse(existing.snapshot)
          : input.snapshot;
        const notification = await tx.notifications.create({
          data: {
            user_id: input.candidate.userId,
            type: NotificationType.weekly_project_report,
            message: `${input.candidate.projectName} weekly report is ready.`,
            related_item_id: input.candidate.projectId,
            dedupe_key: `weekly-project-report:${eventId}`,
          },
          select: { id: true },
        });
        const eventPayload = {
          ...canonicalSnapshot,
          weekLabel: `${canonicalSnapshot.periodStart} to ${canonicalSnapshot.periodEnd}`,
        } satisfies Prisma.JsonObject;
        await tx.weekly_project_reports.create({
          data: {
            project_id: input.candidate.projectId,
            user_id: input.candidate.userId,
            period_start: input.periodStart,
            period_end: input.periodEnd,
            snapshot: canonicalSnapshot,
            notification_id: notification.id,
          },
        });
        await tx.notification_email_events.create({
          data: {
            notification_id: notification.id,
            version: 1,
            template: EmailTemplate.weekly_project_report,
            payload: eventPayload,
          },
        });
        return {
          notificationId: notification.id,
          eventPayload,
          snapshot: canonicalSnapshot,
        };
      });
      return { status: 'created', ...persisted };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const snapshot = await this.findSnapshot({
          projectId: input.candidate.projectId,
          periodStart: input.periodStart,
        });
        if (!snapshot) throw error;
        return { status: 'duplicate', snapshot };
      }
      throw error;
    }
  }
}

export class WeeklyProjectReportGenerator {
  constructor(
    private readonly store: WeeklyProjectReportStore,
    private readonly outboxRepository: Pick<
      PrismaEmailOutboxRepository,
      'createForNotification'
    >
  ) {}

  async generate(now = new Date()): Promise<{
    candidates: number;
    projects: number;
    created: number;
    duplicates: number;
    failed: number;
    outboxFailed: number;
  }> {
    const due = (await this.store.findCandidates()).filter((candidate) =>
      isWeeklyReportDue(candidate, now)
    );
    const { periodStart, periodEnd } = previousUtcWeek(now);
    const snapshots = new Map<string, WeeklyProjectSnapshot>();
    let created = 0;
    let duplicates = 0;
    let failed = 0;
    let outboxFailed = 0;

    for (const candidate of due) {
      try {
        let snapshot = snapshots.get(candidate.projectId);
        if (!snapshot) {
          snapshot =
            (await this.store.findSnapshot({
              projectId: candidate.projectId,
              periodStart,
            })) ??
            (await this.store.buildSnapshot({
              projectId: candidate.projectId,
              projectName: candidate.projectName,
              periodStart,
              periodEnd,
              now,
            }));
          snapshots.set(candidate.projectId, snapshot);
        }
        const result = await this.store.persist({
          candidate,
          snapshot,
          periodStart,
          periodEnd,
        });
        snapshots.set(candidate.projectId, result.snapshot);
        if (result.status === 'created') {
          created += 1;
          try {
            await this.outboxRepository.createForNotification({
              notificationId: result.notificationId!,
              template: EmailTemplate.weekly_project_report,
              payload: result.eventPayload!,
            });
          } catch {
            outboxFailed += 1;
          }
        } else {
          duplicates += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return {
      candidates: due.length,
      projects: snapshots.size,
      created,
      duplicates,
      failed,
      outboxFailed,
    };
  }
}
