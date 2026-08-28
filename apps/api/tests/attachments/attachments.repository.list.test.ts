import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import { attachmentListSelect } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAttachmentListRow } from '../factories/attachment.factory';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    attachments: {
      findMany: findManyMock,
    },
  },
}));

import { AttachmentsRepository } from '../../src/routes/api/attachments/attachments.repository';

const db = {} as SupabaseClient<Database>;
const repository = new AttachmentsRepository(db);

describe('AttachmentsRepository Prisma list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists active attachments by work item with shared select and created_at desc', async () => {
    const row = createAttachmentListRow();
    findManyMock.mockResolvedValue([row]);

    const result = await repository.listByWorkItemId(row.work_item_id);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        work_item_id: row.work_item_id,
        status: 'active',
      },
      orderBy: { created_at: 'desc' },
      select: attachmentListSelect,
    });
    expect(result).toEqual([row]);
  });
});
