import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: apiFetchMock,
}));

import {
  downloadWorklogExcelTemplate,
  importWorkItemWorkLogsExcel,
  previewWorkItemWorkLogsExcel,
} from '@/app/worklogs/_services/worklogs.mutations.client';

const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

describe('worklog Excel client mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the template as a blob', async () => {
    const blob = new Blob(['template']);
    apiFetchMock.mockResolvedValue(blob);

    await expect(downloadWorklogExcelTemplate()).resolves.toBe(blob);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/worklogs/template', {
      responseType: 'blob',
    });
  });

  it.each([
    ['preview', previewWorkItemWorkLogsExcel],
    ['import', importWorkItemWorkLogsExcel],
  ] as const)('posts multipart data to the %s endpoint', async (path, call) => {
    apiFetchMock.mockResolvedValue({});
    const file = new File(['xlsx'], 'worklogs.xlsx');

    await call(WORK_ITEM_ID, file);

    const [, init] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(apiFetchMock.mock.calls[0]?.[0]).toBe(`/api/worklogs/${path}`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('work_item_id')).toBe(WORK_ITEM_ID);
    expect((init.body as FormData).get('file')).toBe(file);
  });
});
