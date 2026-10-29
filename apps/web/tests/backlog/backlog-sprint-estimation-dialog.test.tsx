import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { SprintEstimationResponse } from '@repo/types/api/v1';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BacklogSprintEstimationDialog } from '@/app/backlog/_components/backlog-sprint-estimation-dialog';
import { generateSprintEstimates } from '@/app/sprints/_services/sprint-estimation.mutations.client';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { sprintFactory } from '../factories/sprint.factory';
import { workItemFactory } from '../factories/workItem.factory';

vi.mock('@/app/sprints/_services/sprint-estimation.mutations.client', () => ({
  generateSprintEstimates: vi.fn(),
}));

const SPRINT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SPRINT_ID = '99999999-9999-4999-8999-999999999999';
const FIRST_ITEM_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_ITEM_ID = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_ITEM_ID = '44444444-4444-4444-8444-444444444444';

const sprint = sprintFactory.build({
  id: SPRINT_ID,
  name: 'Planning Sprint',
  project: {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Project Alpha',
    key: 'ALP',
  },
});

const firstItem = workItemFactory.build({
  id: FIRST_ITEM_ID,
  sprint_id: SPRINT_ID,
  project_id: sprint.project!.id,
  title: 'Build estimation dialog',
  type: 'Story',
  priority: 'high',
  story_points: 5,
});
const secondItem = workItemFactory.build({
  id: SECOND_ITEM_ID,
  sprint_id: SPRINT_ID,
  project_id: sprint.project!.id,
  title: 'Document fallback behavior',
  type: 'Task',
  priority: 'medium',
  story_points: 2,
});

function aiEstimate(workItemId = FIRST_ITEM_ID) {
  return {
    workItemId,
    suggestedHours: 8,
    minimumHours: 6,
    maximumHours: 10,
    confidence: 'high' as const,
    source: 'assignee_history' as const,
    evidenceCount: 7,
    roughEstimate: false,
    rationale: 'AI explanation based on comparable completed work.',
    estimationMethod: 'ai' as const,
    fallbackReason: null,
  };
}

function deterministicEstimate(workItemId = SECOND_ITEM_ID) {
  return {
    workItemId,
    suggestedHours: 4,
    minimumHours: 3,
    maximumHours: 6,
    confidence: 'low' as const,
    source: 'rough_fallback' as const,
    evidenceCount: 0,
    roughEstimate: true,
    rationale: 'Rough estimate from the task type fallback.',
    estimationMethod: 'deterministic' as const,
    fallbackReason: 'timeout' as const,
  };
}

function response(
  overrides: Partial<SprintEstimationResponse> = {}
): SprintEstimationResponse {
  return {
    sprintId: SPRINT_ID,
    aiStatus: 'generated',
    estimates: [aiEstimate()],
    ...overrides,
  };
}

function deferred<T>() {
  // eslint-disable-next-line no-unused-vars -- deferred resolver signature
  let resolve!: (value: T) => void;
  // eslint-disable-next-line no-unused-vars -- deferred rejecter signature
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderDialog(
  options: {
    selectedSprint?: typeof sprint | null;
    workItems?: (typeof firstItem)[];
    // eslint-disable-next-line no-unused-vars -- controlled dialog callback
    onOpenChange?: (open: boolean) => void;
  } = {}
) {
  const onOpenChange = options.onOpenChange ?? vi.fn();
  const view = render(
    <BacklogSprintEstimationDialog
      sprint={
        options.selectedSprint === undefined ? sprint : options.selectedSprint
      }
      workItems={options.workItems ?? [firstItem, secondItem]}
      onOpenChange={onOpenChange}
    />
  );
  return { ...view, onOpenChange };
}

describe('BacklogSprintEstimationDialog', () => {
  beforeEach(() => {
    vi.mocked(generateSprintEstimates).mockReset();
  });

  it('loads automatically, prevents duplicate requests, and renders AI results', async () => {
    const pending = deferred<SprintEstimationResponse>();
    vi.mocked(generateSprintEstimates).mockReturnValue(pending.promise);

    renderDialog({ workItems: [firstItem] });

    expect(
      screen.getByRole('heading', { name: 'Estimate Planning Sprint' })
    ).toBeVisible();
    expect(screen.getByText(/Project Alpha/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Generating estimates'
    );
    expect(generateSprintEstimates).toHaveBeenCalledTimes(1);
    expect(generateSprintEstimates).toHaveBeenCalledWith(
      SPRINT_ID,
      expect.any(AbortSignal)
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument();

    pending.resolve(response());

    expect(await screen.findByText('Build estimation dialog')).toBeVisible();
    expect(screen.getByText('ALP-2222')).toBeVisible();
    expect(screen.getByText('8h')).toBeVisible();
    expect(screen.getByText('6–10h range')).toBeVisible();
    expect(screen.getByText('High confidence')).toBeVisible();
    expect(screen.getByText('AI-generated')).toBeVisible();
    expect(screen.getByText(/Assignee history/)).toBeVisible();
    expect(screen.getByText(/7 samples/)).toBeVisible();
    expect(
      screen.getByText('AI explanation based on comparable completed work.')
    ).toBeVisible();
    expect(generateSprintEstimates).toHaveBeenCalledTimes(1);
  });

  it('formats half-hour estimates and ranges with one decimal place', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(
      response({
        estimates: [
          {
            ...aiEstimate(),
            suggestedHours: 8.5,
            minimumHours: 6.5,
            maximumHours: 10.5,
          },
        ],
      })
    );

    renderDialog({ workItems: [firstItem] });

    expect(await screen.findByText('8.5h')).toBeVisible();
    expect(screen.getByText('6.5–10.5h range')).toBeVisible();
  });

  it('preserves backend order and presents mixed AI and deterministic metadata', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(
      response({
        aiStatus: 'partial_fallback',
        estimates: [deterministicEstimate(), aiEstimate()],
      })
    );

    renderDialog();

    expect(
      await screen.findByText(/1 AI-generated and 1 deterministic/i)
    ).toBeVisible();
    const names = screen.getAllByTestId('estimate-work-item-title');
    expect(names.map((name) => name.textContent)).toEqual([
      'Document fallback behavior',
      'Build estimation dialog',
    ]);

    const rows = screen.getAllByTestId('sprint-estimate-row');
    expect(within(rows[0]!).getByText('Deterministic fallback')).toBeVisible();
    expect(within(rows[0]!).getByText('Rough estimate')).toBeVisible();
    expect(within(rows[0]!).getByText('AI request timed out')).toBeVisible();
    expect(within(rows[0]!).getByText(/Rough fallback/)).toBeVisible();
    expect(within(rows[0]!).getByText(/0 samples/)).toBeVisible();
    expect(within(rows[1]!).getByText('AI-generated')).toBeVisible();
  });

  it('contains responsive results without forcing empty table height', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(response());

    renderDialog({ workItems: [firstItem] });

    const row = await screen.findByTestId('sprint-estimate-row');
    const dialog = screen.getByRole('dialog');
    const scrollContainer = screen.getByTestId('sprint-estimate-table-scroll');
    const footer = screen.getByTestId('sprint-estimate-footer');
    const cells = within(row).getAllByRole('cell');

    expect(dialog).toHaveClass(
      'flex',
      'max-h-[calc(100dvh-2rem)]',
      'min-w-0',
      'overflow-hidden'
    );
    expect(scrollContainer).toHaveClass(
      'max-h-[min(58dvh,34rem)]',
      'min-h-0',
      'min-w-0',
      'max-w-full',
      'overflow-auto'
    );
    expect(scrollContainer).not.toHaveClass('h-[min(58vh,34rem)]');
    expect(within(scrollContainer).getByRole('table')).toBeVisible();
    expect(cells[0]).toHaveClass('whitespace-normal');
    expect(cells[3]).toHaveClass('whitespace-normal');
    expect(footer).toHaveClass('shrink-0');
    expect(within(footer).getByRole('button', { name: 'Close' })).toBeVisible();
  });

  it('presents complete deterministic fallback without calling it AI-generated', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(
      response({
        aiStatus: 'fallback',
        estimates: [deterministicEstimate()],
      })
    );

    renderDialog({ workItems: [secondItem] });

    expect(
      await screen.findByText(/AI was unavailable.*deterministic estimate/i)
    ).toBeVisible();
    expect(screen.queryByText('AI-generated')).not.toBeInTheDocument();
    expect(screen.getByText('Deterministic fallback')).toBeVisible();
  });

  it('shows an empty state for a sprint with no estimable items', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(
      response({ aiStatus: 'empty', estimates: [] })
    );

    renderDialog({ workItems: [] });

    expect(
      await screen.findByText('No estimable work items in this sprint.')
    ).toBeVisible();
  });

  it('uses a safe identifier when local work-item context is unavailable', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(
      response({ estimates: [aiEstimate(UNKNOWN_ITEM_ID)] })
    );

    renderDialog({ workItems: [] });

    expect(await screen.findByText('Work item 44444444')).toBeVisible();
    expect(screen.getByText(UNKNOWN_ITEM_ID)).toBeVisible();
  });

  it.each([
    [401, 'Your session has expired. Please sign in again.'],
    [403, 'You do not have permission to estimate this sprint.'],
    [404, 'This sprint is no longer available.'],
    [422, 'A sprint can contain at most 200 estimable work items.'],
    [500, 'Sprint estimates could not be generated. Please try again.'],
  ])('maps HTTP %s to a safe error', async (status, message) => {
    vi.mocked(generateSprintEstimates).mockRejectedValue(
      new ApiError('internal detail', status)
    );

    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('offers a manual retry after failure', async () => {
    vi.mocked(generateSprintEstimates)
      .mockRejectedValueOnce(new Error('network detail'))
      .mockResolvedValueOnce(response({ aiStatus: 'empty', estimates: [] }));

    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByText('No estimable work items in this sprint.')
    ).toBeVisible();
    expect(generateSprintEstimates).toHaveBeenCalledTimes(2);
  });

  it('cancels an active request when closed without showing an error', async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(generateSprintEstimates).mockImplementation((_id, signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });
    const onOpenChange = vi.fn();

    renderDialog({ onOpenChange });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(requestSignal?.aborted).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancels an active request when unmounted', () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(generateSprintEstimates).mockImplementation((_id, signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });

    const view = renderDialog();
    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it('aborts on Escape and ignores the cancelled request after reopening', async () => {
    const cancelledRequest = deferred<SprintEstimationResponse>();
    const reopenedRequest = deferred<SprintEstimationResponse>();
    let cancelledSignal: AbortSignal | undefined;
    vi.mocked(generateSprintEstimates)
      .mockImplementationOnce((_id, signal) => {
        cancelledSignal = signal;
        return cancelledRequest.promise;
      })
      .mockReturnValueOnce(reopenedRequest.promise);

    const view = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(view.onOpenChange).toHaveBeenCalledWith(false);
    expect(cancelledSignal?.aborted).toBe(true);

    view.rerender(
      <BacklogSprintEstimationDialog
        sprint={null}
        workItems={[firstItem]}
        onOpenChange={view.onOpenChange}
      />
    );
    view.rerender(
      <BacklogSprintEstimationDialog
        sprint={sprint}
        workItems={[firstItem]}
        onOpenChange={view.onOpenChange}
      />
    );

    cancelledRequest.resolve(response());
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Generating estimates'
      );
    });
    expect(
      screen.queryByText('Build estimation dialog')
    ).not.toBeInTheDocument();

    reopenedRequest.resolve(response());
    expect(await screen.findByText('Build estimation dialog')).toBeVisible();
    expect(generateSprintEstimates).toHaveBeenCalledTimes(2);
  });

  it('prevents a stale response from replacing a newer sprint result', async () => {
    const firstRequest = deferred<SprintEstimationResponse>();
    const secondRequest = deferred<SprintEstimationResponse>();
    vi.mocked(generateSprintEstimates)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const otherSprint = { ...sprint, id: OTHER_SPRINT_ID, name: 'Next Sprint' };

    const view = renderDialog();
    view.rerender(
      <BacklogSprintEstimationDialog
        sprint={otherSprint}
        workItems={[secondItem]}
        onOpenChange={view.onOpenChange}
      />
    );

    secondRequest.resolve(
      response({
        sprintId: OTHER_SPRINT_ID,
        estimates: [aiEstimate(SECOND_ITEM_ID)],
      })
    );
    expect(await screen.findByText('Document fallback behavior')).toBeVisible();

    firstRequest.resolve(response());
    await waitFor(() => {
      expect(screen.getByText('Document fallback behavior')).toBeVisible();
    });
    expect(
      screen.queryByText('Build estimation dialog')
    ).not.toBeInTheDocument();
  });

  it('is read-only and exposes an accessible close action', async () => {
    vi.mocked(generateSprintEstimates).mockResolvedValue(response());

    renderDialog({ workItems: [firstItem] });

    await screen.findByText('Build estimation dialog');
    expect(
      screen.getAllByRole('button', { name: 'Close' }).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /save|apply|update/i })
    ).not.toBeInTheDocument();
  });
});
