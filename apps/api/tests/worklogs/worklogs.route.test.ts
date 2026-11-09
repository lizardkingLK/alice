import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listByWorkItemIdMock,
  createWorkLogMock,
  createExcelTemplateMock,
  previewExcelWorklogsMock,
  importExcelWorklogsMock,
} = vi.hoisted(() => ({
  listByWorkItemIdMock: vi.fn(),
  createWorkLogMock: vi.fn(),
  createExcelTemplateMock: vi.fn(),
  previewExcelWorklogsMock: vi.fn(),
  importExcelWorklogsMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/worklogs/worklogs.service', () => {
  class WorklogsService {
    listByWorkItemId = listByWorkItemIdMock;
    createWorkLog = createWorkLogMock;
    createExcelTemplate = createExcelTemplateMock;
    previewExcelWorklogs = previewExcelWorklogsMock;
    importExcelWorklogs = importExcelWorklogsMock;
  }

  return { WorklogsService };
});

import { createWorklogsRouter } from '../../src/routes/api/worklogs/worklogs.route';
import { WorklogExcelValidationError } from '../../src/routes/api/worklogs/worklogs.excel';
import type { WorklogsService } from '../../src/routes/api/worklogs/worklogs.service';
import {
  WorkItemAccessError,
  WorkItemValidationError,
} from '../../src/routes/api/work-items/work-items.errors';
import { createWorkLogListRow } from '../factories/worklog.factory';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const worklogsService = {
  listByWorkItemId: listByWorkItemIdMock,
  createWorkLog: createWorkLogMock,
  createExcelTemplate: createExcelTemplateMock,
  previewExcelWorklogs: previewExcelWorklogsMock,
  importExcelWorklogs: importExcelWorklogsMock,
} as unknown as WorklogsService;

const worklogsRouter = createWorklogsRouter({ worklogsService });
const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

function excelUploadForm(options?: {
  fileName?: string;
  bytes?: Uint8Array;
}): FormData {
  const form = new FormData();
  const bytes = options?.bytes ?? new Uint8Array([1, 2, 3]);
  const fileContents = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(fileContents).set(bytes);
  form.append('work_item_id', WORK_ITEM_ID);
  form.append(
    'file',
    new Blob([fileContents], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    options?.fileName ?? 'worklogs.xlsx'
  );
  return form;
}

describe('worklogs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns work log rows for a work item', async () => {
    const row = createWorkLogListRow();
    listByWorkItemIdMock.mockResolvedValue([row]);

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/worklogs?work_item_id=${row.work_item_id}`
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(JSON.parse(JSON.stringify([row])));
        expect(listByWorkItemIdMock).toHaveBeenCalledWith(
          row.work_item_id,
          MOCK_AUTH_USER_ID
        );
      }
    );
  });

  it('rejects missing work_item_id on list', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`);
        expect(response.status).toBe(400);
        expect(listByWorkItemIdMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns 403 when list access is denied', async () => {
    listByWorkItemIdMock.mockRejectedValue(new WorkItemAccessError());

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/worklogs?work_item_id=22222222-2222-4222-8222-222222222222`
        );
        expect(response.status).toBe(403);
      }
    );
  });

  it('creates a work log', async () => {
    const row = createWorkLogListRow();
    createWorkLogMock.mockResolvedValue(row);

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: row.work_item_id,
            logged_hours: 2.5,
            logged_at: '2026-08-01',
            comment: 'Implemented API versioning',
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body).toEqual({ worklog: JSON.parse(JSON.stringify(row)) });
        expect(createWorkLogMock).toHaveBeenCalledWith(
          MOCK_AUTH_USER_ID,
          expect.objectContaining({
            workItemId: row.work_item_id,
            loggedHours: 2.5,
            comment: 'Implemented API versioning',
          })
        );
      }
    );
  });

  it('rejects invalid create payloads', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: 'not-a-uuid',
            logged_hours: 0,
          }),
        });

        expect(response.status).toBe(400);
        expect(createWorkLogMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns 400 when create is blocked for Done work items', async () => {
    createWorkLogMock.mockRejectedValue(
      new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      )
    );

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: '22222222-2222-4222-8222-222222222222',
            logged_hours: 1,
          }),
        });

        expect(response.status).toBe(400);
      }
    );
  });

  it('downloads the authenticated Excel template', async () => {
    createExcelTemplateMock.mockResolvedValue(Buffer.from('xlsx-template'));

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/template`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        expect(response.headers.get('content-disposition')).toContain(
          'worklog-upload-template.xlsx'
        );
        expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
          'xlsx-template'
        );
        expect(createExcelTemplateMock).toHaveBeenCalledOnce();
      }
    );
  });

  it('previews an xlsx for the selected work item and authenticated user', async () => {
    previewExcelWorklogsMock.mockResolvedValue({
      rows: [
        {
          rowNumber: 2,
          startAt: '2026-11-05T08:00:00.000Z',
          endAt: '2026-11-05T09:30:00.000Z',
          loggedHours: 1.5,
          description: 'Imported work',
        },
      ],
    });

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/preview`, {
          method: 'POST',
          body: excelUploadForm(),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
          row_count: 1,
          rows: [
            {
              row_number: 2,
              start_at: '2026-11-05T08:00:00.000Z',
              end_at: '2026-11-05T09:30:00.000Z',
              logged_hours: 1.5,
              description: 'Imported work',
            },
          ],
        });
        expect(previewExcelWorklogsMock).toHaveBeenCalledWith(
          MOCK_AUTH_USER_ID,
          WORK_ITEM_ID,
          expect.any(Buffer)
        );
      }
    );
  });

  it('imports an xlsx and returns the inserted row count', async () => {
    importExcelWorklogsMock.mockResolvedValue({ importedCount: 2 });

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/import`, {
          method: 'POST',
          body: excelUploadForm(),
        });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ imported_count: 2 });
        expect(importExcelWorklogsMock).toHaveBeenCalledWith(
          MOCK_AUTH_USER_ID,
          WORK_ITEM_ID,
          expect.any(Buffer)
        );
      }
    );
  });

  it('returns Excel row validation errors and does not import', async () => {
    previewExcelWorklogsMock.mockRejectedValue(
      new WorklogExcelValidationError([
        {
          rowNumber: 7,
          field: 'End Date/Time',
          message: 'End Date/Time must be later than Start Date/Time.',
        },
      ])
    );

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/preview`, {
          method: 'POST',
          body: excelUploadForm(),
        });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({
          error:
            'Excel validation failed: row 7: End Date/Time must be later than Start Date/Time.',
          errors: [
            {
              row_number: 7,
              field: 'End Date/Time',
              message: 'End Date/Time must be later than Start Date/Time.',
            },
          ],
        });
        expect(importExcelWorklogsMock).not.toHaveBeenCalled();
      }
    );
  });

  it('rejects non-xlsx files before calling the service', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/import`, {
          method: 'POST',
          body: excelUploadForm({ fileName: 'worklogs.csv' }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: 'An .xlsx file is required.',
        });
        expect(importExcelWorklogsMock).not.toHaveBeenCalled();
      }
    );
  });

  it('rejects files larger than 2 MB before calling the service', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs/import`, {
          method: 'POST',
          body: excelUploadForm({
            bytes: new Uint8Array(2 * 1024 * 1024 + 1),
          }),
        });

        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toEqual({
          error: 'The .xlsx file must not exceed 2 MB.',
        });
        expect(importExcelWorklogsMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns permission and Done errors from upload endpoints', async () => {
    previewExcelWorklogsMock.mockRejectedValueOnce(new WorkItemAccessError());
    importExcelWorklogsMock.mockRejectedValueOnce(
      new WorkItemValidationError('Done work items are read-only.')
    );

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const denied = await fetch(`${baseUrl}/api/worklogs/preview`, {
          method: 'POST',
          body: excelUploadForm(),
        });
        const done = await fetch(`${baseUrl}/api/worklogs/import`, {
          method: 'POST',
          body: excelUploadForm(),
        });

        expect(denied.status).toBe(403);
        expect(done.status).toBe(400);
      }
    );
  });
});
