import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { WorkItemWorkLogExcelDialog } from '@/app/work-items/_components/work-item-work-logs/work-item-work-log-excel-dialog';

const { previewMock, importMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  importMock: vi.fn(),
}));

vi.mock('@/app/worklogs/_services/worklogs.mutations.client', () => ({
  previewWorkItemWorkLogsExcel: previewMock,
  importWorkItemWorkLogsExcel: importMock,
}));

const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

function selectFile(file: File): void {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected file input');
  }
  fireEvent.change(input, { target: { files: [file] } });
}

describe('WorkItemWorkLogExcelDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('previews a selected xlsx and confirms before importing', async () => {
    previewMock.mockResolvedValue({
      row_count: 1,
      rows: [
        {
          row_number: 2,
          start_at: '2026-11-05T08:00:00.000Z',
          end_at: '2026-11-05T10:30:00.000Z',
          logged_hours: 2.5,
          description: 'Imported work',
        },
      ],
    });
    importMock.mockResolvedValue({ imported_count: 1 });
    const onImported = vi.fn();
    render(
      <WorkItemWorkLogExcelDialog
        open
        onOpenChange={() => {}}
        workItemId={WORK_ITEM_ID}
        onImported={onImported}
      />
    );

    selectFile(
      new File(['xlsx'], 'worklogs.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );

    expect(await screen.findByText('Imported work')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 worklog' }));
    expect(importMock).not.toHaveBeenCalled();
    expect(screen.getByText(/save 1 worklog/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(() => {
      expect(importMock).toHaveBeenCalledWith(
        WORK_ITEM_ID,
        expect.objectContaining({ name: 'worklogs.xlsx' })
      );
      expect(onImported).toHaveBeenCalledWith(1);
    });
  });

  it('shows row-numbered server validation errors', async () => {
    previewMock.mockRejectedValue(
      new ApiError('Excel validation failed.', 400, {
        details: [
          {
            row_number: 7,
            field: 'End Date/Time',
            message: 'End Date/Time must be later than Start Date/Time.',
          },
        ],
      })
    );
    render(
      <WorkItemWorkLogExcelDialog
        open
        onOpenChange={() => {}}
        workItemId={WORK_ITEM_ID}
        onImported={() => {}}
      />
    );

    selectFile(new File(['xlsx'], 'invalid.xlsx'));

    expect(await screen.findByText(/Row 7/)).toBeInTheDocument();
    expect(
      screen.getByText(/End Date\/Time must be later/i)
    ).toBeInTheDocument();
    expect(importMock).not.toHaveBeenCalled();
  });

  it('rejects non-xlsx files before previewing', async () => {
    render(
      <WorkItemWorkLogExcelDialog
        open
        onOpenChange={() => {}}
        workItemId={WORK_ITEM_ID}
        onImported={() => {}}
      />
    );

    selectFile(new File(['csv'], 'worklogs.csv'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose an .xlsx file no larger than 2 MB.'
    );
    expect(previewMock).not.toHaveBeenCalled();
  });
});
