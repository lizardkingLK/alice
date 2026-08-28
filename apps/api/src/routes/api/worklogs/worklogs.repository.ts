import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import {
  Database,
  WORK_ITEM_WORKLOG_SELECT,
  normalizeWorkLogRow,
  workLogListSelect,
  type WorkItemWorkLog,
  type WorkItemWorkLogRowRaw,
  type WorkLogListRow,
} from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';

export type CreateWorkLogInput = {
  workItemId: string;
  actorId: string;
  loggedHours: number;
  loggedAtIso: string;
  comment: string | null;
};

export class WorklogsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Unused Express list path (Prisma). Do not call from mutation hot paths.
   */
  async listByWorkItemId(workItemId: string): Promise<WorkLogListRow[]> {
    return await prisma.work_item_worklogs.findMany({
      where: {
        work_item_id: workItemId,
        status: 'active',
      },
      orderBy: { logged_at: 'desc' },
      select: workLogListSelect,
    });
  }

  async create(input: CreateWorkLogInput): Promise<WorkItemWorkLog> {
    const created = await prisma.work_item_worklogs.create({
      data: {
        work_item_id: input.workItemId,
        user_id: input.actorId,
        logged_hours: input.loggedHours,
        logged_at: prismaOptionalDate(input.loggedAtIso)!,
        comment: input.comment,
        ...prismaAuditCreate(input.actorId),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data, error } = await db
      .from('work_item_worklogs')
      .select(WORK_ITEM_WORKLOG_SELECT)
      .eq('id', created.id)
      .single();

    if (error || !data) {
      console.error(
        'error. failed to create work item work log:',
        error?.message
      );
      throw new Error('Failed to create work log');
    }

    return normalizeWorkLogRow(data as unknown as WorkItemWorkLogRowRaw);
  }
}
