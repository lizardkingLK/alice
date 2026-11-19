import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemAccessError } from '../../src/routes/api/work-items/work-items.errors';
import { WorklogExcelValidationError } from '../../src/routes/api/worklogs/worklogs.excel';
import type { WorklogsRepository } from '../../src/routes/api/worklogs/worklogs.repository';
import { WorklogsService } from '../../src/routes/api/worklogs/worklogs.service';

const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

async function validWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Worklogs');
  sheet.addRow(['Start Date/Time', 'End Date/Time', 'Description']);
  sheet.addRow(['2026-11-05 08:00', '2026-11-05 09:30', 'First row']);
  sheet.addRow(['2026-11-05 23:00', '2026-11-06 01:00', 'Overnight']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('WorklogsService Excel import', () => {
  const createManyAtomic = vi.fn();
  const requireProjectMember = vi.fn();
  const getById = vi.fn();
  const repository = {
    createManyAtomic,
  } as unknown as WorklogsRepository;
  const service = new WorklogsService(repository, {
    requireProjectMember,
    getById,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectMember.mockResolvedValue(undefined);
    getById.mockResolvedValue({ status: 'In Progress' });
  });

  it('previews parsed rows after checking project access and work item state', async () => {
    const result = await service.previewExcelWorklogs(
      ACTOR_ID,
      WORK_ITEM_ID,
      await validWorkbook()
    );

    expect(requireProjectMember).toHaveBeenCalledWith(WORK_ITEM_ID, ACTOR_ID);
    expect(getById).toHaveBeenCalledWith(WORK_ITEM_ID);
    expect(result).toEqual({
      rows: [
        expect.objectContaining({ rowNumber: 2, loggedHours: 1.5 }),
        expect.objectContaining({ rowNumber: 3, loggedHours: 2 }),
      ],
    });
    expect(createManyAtomic).not.toHaveBeenCalled();
  });

  it('imports every row for the selected work item and authenticated actor', async () => {
    createManyAtomic.mockResolvedValue(2);

    const result = await service.importExcelWorklogs(
      ACTOR_ID,
      WORK_ITEM_ID,
      await validWorkbook()
    );

    expect(result).toEqual({ importedCount: 2 });
    expect(createManyAtomic).toHaveBeenCalledWith([
      {
        workItemId: WORK_ITEM_ID,
        actorId: ACTOR_ID,
        loggedHours: 1.5,
        loggedAtIso: '2026-11-05T08:00:00.000Z',
        comment: 'First row',
      },
      {
        workItemId: WORK_ITEM_ID,
        actorId: ACTOR_ID,
        loggedHours: 2,
        loggedAtIso: '2026-11-05T23:00:00.000Z',
        comment: 'Overnight',
      },
    ]);
  });

  it('rejects unauthorized access before parsing or writing', async () => {
    requireProjectMember.mockRejectedValue(new WorkItemAccessError());

    await expect(
      service.importExcelWorklogs(
        ACTOR_ID,
        WORK_ITEM_ID,
        Buffer.from('not an xlsx')
      )
    ).rejects.toBeInstanceOf(WorkItemAccessError);

    expect(getById).not.toHaveBeenCalled();
    expect(createManyAtomic).not.toHaveBeenCalled();
  });

  it('rejects imports for Done work items before parsing or writing', async () => {
    getById.mockResolvedValue({ status: 'Done' });

    await expect(
      service.importExcelWorklogs(
        ACTOR_ID,
        WORK_ITEM_ID,
        Buffer.from('not an xlsx')
      )
    ).rejects.toThrow('Done work items are read-only');

    expect(createManyAtomic).not.toHaveBeenCalled();
  });

  it('does not write when workbook validation fails', async () => {
    await expect(
      service.importExcelWorklogs(
        ACTOR_ID,
        WORK_ITEM_ID,
        Buffer.from('not an xlsx')
      )
    ).rejects.toBeInstanceOf(WorklogExcelValidationError);

    expect(createManyAtomic).not.toHaveBeenCalled();
  });
});
