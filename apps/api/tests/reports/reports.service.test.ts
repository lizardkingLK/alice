import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportsRepository } from '../../src/routes/api/reports/reports.repository';
import {
  ReportAccessError,
  ReportsService,
} from '../../src/routes/api/reports/reports.service';

const { listAccessibleProjectIdsMock, listDailyReportItemsMock } = vi.hoisted(
  () => ({
    listAccessibleProjectIdsMock: vi.fn(),
    listDailyReportItemsMock: vi.fn(),
  })
);

const repository = {
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
  listDailyReportItems: listDailyReportItemsMock,
} as unknown as ReportsRepository;

const service = new ReportsService(
  repository,
  () => new Date('2026-10-20T12:00:00.000Z')
);

const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_PROJECT_ID = '55555555-5555-4555-8555-555555555555';
const SPRINT_ID = '44444444-4444-4444-8444-444444444444';

describe('ReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);
    listDailyReportItemsMock.mockResolvedValue([]);
  });

  it('generates deterministic snapshot, Markdown, and metadata', async () => {
    const result = await service.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      verbosity: 'standard',
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
    });

    expect(listDailyReportItemsMock).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
      start: new Date('2026-10-19T18:30:00.000Z'),
      endExclusive: new Date('2026-10-20T18:30:00.000Z'),
    });
    expect(result.snapshot.summary.completed).toBe(0);
    expect(result.markdown).toContain('# Daily Report — 2026-10-20');
    expect(result.metadata).toEqual({
      reportType: 'daily',
      generatedAt: '2026-10-20T12:00:00.000Z',
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      verbosity: 'standard',
      filters: { projectIds: [PROJECT_ID], sprintIds: [SPRINT_ID] },
      upcomingDeadlineDays: 7,
    });
  });

  it('uses every accessible project when no project filter is supplied', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([
      PROJECT_ID,
      OTHER_PROJECT_ID,
    ]);

    await service.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'concise',
    });

    expect(listDailyReportItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: [PROJECT_ID, OTHER_PROJECT_ID],
      })
    );
  });

  it('rejects a project filter containing any inaccessible project', async () => {
    await expect(
      service.generate(ACTOR_ID, {
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'standard',
        projectIds: [PROJECT_ID, OTHER_PROJECT_ID],
      })
    ).rejects.toBeInstanceOf(ReportAccessError);
    expect(listDailyReportItemsMock).not.toHaveBeenCalled();
  });
});
