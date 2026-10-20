import type {
  GenerateReportRequest,
  GenerateReportResponse,
} from '@repo/types';
import {
  buildDailyReportSnapshot,
  UPCOMING_DEADLINE_DAYS,
} from './reports.aggregation';
import { renderDailyReportMarkdown } from './reports.markdown';
import type { ReportsRepository } from './reports.repository';
import { dailyReportUtcRange } from './reports.timezone';

export class ReportAccessError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ReportAccessError';
  }
}

export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async generate(
    actorId: string,
    request: GenerateReportRequest
  ): Promise<GenerateReportResponse> {
    const accessibleProjectIds =
      await this.repository.listAccessibleProjectIds(actorId);
    const projectIds = request.projectIds ?? accessibleProjectIds;

    if (
      request.projectIds?.some(
        (projectId) => !accessibleProjectIds.includes(projectId)
      )
    ) {
      throw new ReportAccessError();
    }

    const { start, endExclusive } = dailyReportUtcRange(
      request.reportDate,
      request.timezone
    );
    const sourceItems = await this.repository.listDailyReportItems({
      actorId,
      projectIds,
      ...(request.sprintIds ? { sprintIds: request.sprintIds } : {}),
      start,
      endExclusive,
    });
    const snapshot = buildDailyReportSnapshot(sourceItems, {
      reportDate: request.reportDate,
      timezone: request.timezone,
      start,
      endExclusive,
    });

    return {
      snapshot,
      markdown: renderDailyReportMarkdown(snapshot, request.verbosity),
      metadata: {
        reportType: 'daily',
        generatedAt: this.now().toISOString(),
        reportDate: request.reportDate,
        timezone: request.timezone,
        verbosity: request.verbosity,
        filters: {
          projectIds: request.projectIds ?? [],
          sprintIds: request.sprintIds ?? [],
        },
        upcomingDeadlineDays: UPCOMING_DEADLINE_DAYS,
      },
    };
  }
}
