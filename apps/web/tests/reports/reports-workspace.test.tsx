import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsWorkspace } from '@/app/reports/_components/reports-workspace';
import { generateDailyReport } from '@/app/reports/_services/reports.mutations.client';
import { downloadReportMarkdown } from '@/app/reports/_helpers/report-download';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  configureNextNavigationMock,
  mockReplace,
  resetNextNavigationMock,
} from '../mocks/next-navigation';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));
vi.mock('@/app/reports/_services/reports.mutations.client', () => ({
  generateDailyReport: vi.fn(),
}));
vi.mock('@/app/reports/_helpers/report-download', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/app/reports/_helpers/report-download')
    >();
  return { ...actual, downloadReportMarkdown: vi.fn() };
});

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const SPRINT_ID = '33333333-3333-4333-8333-333333333333';

const options = {
  projects: [
    { id: PROJECT_ID, name: 'Alpha', key: 'ALP' },
    { id: OTHER_PROJECT_ID, name: 'Beta', key: 'BET' },
  ],
  sprints: [{ id: SPRINT_ID, name: 'Alpha Sprint', projectId: PROJECT_ID }],
};

const workItem = {
  id: 'item-1',
  title: 'Ship report preview',
  type: 'Task' as const,
  priority: 'medium' as const,
  project: { id: PROJECT_ID, key: 'ALP', name: 'Alpha' },
  sprint: { id: SPRINT_ID, name: 'Alpha Sprint' },
  dueDate: '2026-10-20',
  storyPoints: 3,
  statusCategory: 'done' as const,
  stateId: 'custom-done',
  doneAt: '2026-10-20T08:30:00.000Z',
};

const generatedReport = {
  snapshot: {
    reportDate: '2026-10-20',
    timezone: 'UTC',
    utcRange: {
      start: '2026-10-20T00:00:00.000Z',
      endExclusive: '2026-10-21T00:00:00.000Z',
    },
    summary: {
      completed: 1,
      inProgress: 2,
      pending: 3,
      blocked: 1,
      dueToday: 1,
      overdue: 4,
      upcomingDeadlines: 2,
    },
    completed: [workItem],
    inProgress: [],
    pending: [],
    blocked: [],
    dueToday: [workItem],
    overdue: [],
    upcomingDeadlines: [],
  },
  markdown: '# Daily Report\n\n## Completed\n\n- **Ship report preview**',
  metadata: {
    reportType: 'daily' as const,
    generatedAt: '2026-10-20T12:00:00.000Z',
    reportDate: '2026-10-20',
    timezone: 'UTC',
    verbosity: 'standard' as const,
    filters: { projectIds: [], sprintIds: [] },
    upcomingDeadlineDays: 7,
  },
};

const generatedAiReport = {
  ...generatedReport,
  markdown: `${generatedReport.markdown}\n\n## AI Insights\n\n### Overall Progress\n\nThe selected work is progressing.`,
  aiInsightsStatus: 'generated' as const,
  aiInsights: {
    completedWork: [],
    importantInProgress: [],
    pendingTasks: [],
    blockedAndOverdue: [],
    potentialRisks: [],
    upcomingDeadlines: [],
    nextPriorities: [],
    overallProgress: 'The selected work is progressing.',
  },
};

const unavailableAiReport = {
  ...generatedReport,
  aiInsightsStatus: 'unavailable' as const,
};

function renderWorkspace(search = 'date=2026-10-20&timezone=UTC') {
  configureNextNavigationMock({
    pathname: '/reports',
    searchParams: Object.fromEntries(new URLSearchParams(search)),
  });
  return render(<ReportsWorkspace {...options} />);
}

describe('ReportsWorkspace', () => {
  beforeEach(() => {
    resetNextNavigationMock();
    vi.mocked(generateDailyReport).mockReset();
    vi.mocked(downloadReportMarkdown).mockReset();
  });

  it('renders Daily Report defaults without generating automatically', () => {
    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Daily Report' })).toBeVisible();
    expect(screen.getByLabelText('Report date')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('Timezone')).toHaveValue('UTC');
    expect(screen.getByLabelText('Report Detail')).toHaveValue('standard');
    expect(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    ).not.toBeChecked();
    expect(
      screen.getByText(
        'Use AI to explain progress, risks, and suggested next priorities.'
      )
    ).toBeVisible();
    expect(
      screen.getByText('Choose how much information to include in your report.')
    ).toBeVisible();
    expect(screen.getByRole('option', { name: 'Short' })).toHaveValue(
      'concise'
    );
    expect(screen.getByRole('option', { name: 'Normal' })).toHaveValue(
      'standard'
    );
    expect(screen.getByText('All accessible projects')).toBeVisible();
    expect(screen.getByText('All sprints')).toBeVisible();
    expect(generateDailyReport).not.toHaveBeenCalled();
    expect(screen.getByText(/configure your report/i)).toBeVisible();
  });

  it('changes the AI opt-in locally without generating a report', () => {
    renderWorkspace();
    const checkbox = screen.getByRole('checkbox', {
      name: 'Include AI insights',
    });

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(generateDailyReport).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('initializes filters from URL parameters', () => {
    renderWorkspace(
      `date=2026-10-19&timezone=Asia%2FColombo&projects=${PROJECT_ID}&sprints=${SPRINT_ID}&verbosity=detailed`
    );

    expect(screen.getByLabelText('Report date')).toHaveValue('2026-10-19');
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Colombo');
    expect(screen.getByLabelText('Report Detail')).toHaveValue('detailed');
    expect(screen.getByLabelText('Alpha (ALP)')).toBeChecked();
    expect(screen.getByLabelText('Alpha Sprint')).toBeChecked();
  });

  it('keeps changed filters in the URL for saved views', () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText('Report Detail'), {
      target: { value: 'concise' },
    });
    expect(mockReplace).toHaveBeenLastCalledWith(
      expect.stringContaining('verbosity=concise'),
      { scroll: false }
    );

    fireEvent.click(screen.getByLabelText('Alpha (ALP)'));
    expect(mockReplace).toHaveBeenLastCalledWith(
      expect.stringContaining(`projects=${PROJECT_ID}`),
      { scroll: false }
    );
  });

  it('generates and renders summary metrics, metadata, and Markdown', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(generatedReport);
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    await waitFor(() =>
      expect(generateDailyReport).toHaveBeenCalledWith({
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'standard',
        includeAiInsights: false,
      })
    );
    for (const [label, value] of [
      ['Completed', '1'],
      ['In progress', '2'],
      ['Pending', '3'],
      ['Blocked', '1'],
      ['Overdue', '4'],
    ] as const) {
      const metricLabel = screen
        .getAllByText(label, { exact: true })
        .find(
          (element) => element.nextElementSibling?.textContent?.trim() === value
        );
      expect(metricLabel).toBeVisible();
      expect(metricLabel?.nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeVisible();
    expect(screen.getByText('Ship report preview')).toBeVisible();
    expect(screen.getByText(/current work-item state/i)).toBeVisible();
    expect(screen.getByText(/generated/i)).toBeVisible();
    expect(
      screen.queryByText(/AI insights are unavailable right now/i)
    ).not.toBeInTheDocument();
  });

  it('sends the complete report configuration when AI is enabled', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(generatedAiReport);
    renderWorkspace(
      `date=2026-10-19&timezone=Asia%2FColombo&projects=${PROJECT_ID}&sprints=${SPRINT_ID}&verbosity=detailed`
    );

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    await waitFor(() =>
      expect(generateDailyReport).toHaveBeenCalledWith({
        reportType: 'daily',
        reportDate: '2026-10-19',
        timezone: 'Asia/Colombo',
        verbosity: 'detailed',
        projectIds: [PROJECT_ID],
        sprintIds: [SPRINT_ID],
        includeAiInsights: true,
      })
    );
  });

  it('renders generated AI Markdown once alongside deterministic metrics', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(generatedAiReport);
    renderWorkspace();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(
      await screen.findByRole('heading', { name: 'AI Insights' })
    ).toBeVisible();
    expect(
      screen.getAllByRole('heading', { name: 'AI Insights' })
    ).toHaveLength(1);
    const completedMetric = screen
      .getAllByText('Completed', { exact: true })
      .find(
        (element) => element.nextElementSibling?.textContent?.trim() === '1'
      );
    expect(completedMetric).toBeVisible();
  });

  it('includes selected project and sprint filters in the request', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(generatedReport);
    renderWorkspace(
      `date=2026-10-20&timezone=UTC&projects=${PROJECT_ID}&sprints=${SPRINT_ID}`
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    await waitFor(() =>
      expect(generateDailyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectIds: [PROJECT_ID],
          sprintIds: [SPRINT_ID],
        })
      )
    );
  });

  it('disables repeated submission while generating', async () => {
    // eslint-disable-next-line no-unused-vars -- promise resolver signature
    let resolveReport!: (_value: typeof generatedReport) => void;
    vi.mocked(generateDailyReport).mockReturnValue(
      new Promise((resolve) => {
        resolveReport = resolve;
      })
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(
      screen.getByRole('button', { name: 'Generating report' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generating report' }));
    expect(generateDailyReport).toHaveBeenCalledOnce();

    resolveReport(generatedReport);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Generate report' })
      ).toBeEnabled()
    );
  });

  it('shows a meaningful forbidden error', async () => {
    vi.mocked(generateDailyReport).mockRejectedValue(
      new ApiError('Forbidden', 403)
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have access/i
    );
  });

  it('shows a sign-in message for an unauthorized response', async () => {
    vi.mocked(generateDailyReport).mockRejectedValue(
      new ApiError('Unauthorized', 401)
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /session has expired/i
    );
  });

  it('handles an empty report gracefully', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue({
      ...generatedReport,
      snapshot: {
        ...generatedReport.snapshot,
        summary: {
          completed: 0,
          inProgress: 0,
          pending: 0,
          blocked: 0,
          dueToday: 0,
          overdue: 0,
          upcomingDeadlines: 0,
        },
        completed: [],
        dueToday: [],
      },
      markdown: '# Daily Report\n\nNo matching work items.',
    });
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByText('No matching work items')).toBeVisible();
  });

  it('shows a non-blocking warning while keeping an unavailable report usable', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(unavailableAiReport);
    renderWorkspace();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'AI insights are unavailable right now. Your regular report was generated successfully.'
    );
    expect(screen.getByText('Ship report preview')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download Markdown' })
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    );
    expect(screen.getByRole('status')).toBeVisible();
    expect(generateDailyReport).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Download Markdown' }));
    expect(downloadReportMarkdown).toHaveBeenCalledWith(
      unavailableAiReport.markdown,
      'daily',
      '2026-10-20'
    );
  });

  it('replaces an old AI warning with the latest successful report state', async () => {
    vi.mocked(generateDailyReport)
      .mockResolvedValueOnce(unavailableAiReport)
      .mockResolvedValueOnce(generatedAiReport);
    renderWorkspace();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include AI insights' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(await screen.findByRole('status')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(
      await screen.findByRole('heading', { name: 'AI Insights' })
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('downloads the exact generated Markdown', async () => {
    vi.mocked(generateDailyReport).mockResolvedValue(generatedAiReport);
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Download Markdown' })
    );
    expect(downloadReportMarkdown).toHaveBeenCalledWith(
      generatedAiReport.markdown,
      'daily',
      '2026-10-20'
    );
  });
});
