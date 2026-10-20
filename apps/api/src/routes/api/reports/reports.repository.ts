import {
  WORKFLOW_STATE_CATEGORIES,
  parseWorkItemLabels,
  resolveWorkItemState,
  type Database,
  type WorkflowStateCategory,
} from '@repo/types';
import { Prisma, RecordStatus } from '@repo/types/prisma';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { prisma } from '../../../lib/prisma';
import type { DailyReportSourceItem } from './reports.aggregation';

export const dailyReportWorkItemSelect = {
  id: true,
  title: true,
  type: true,
  priority: true,
  due_date: true,
  story_points: true,
  status: true,
  status_category: true,
  state: true,
  state_id: true,
  board_column_id: true,
  state_workflow_id: true,
  labels: true,
  done_at: true,
  project: { select: { id: true, key: true, name: true } },
  sprint: { select: { id: true, name: true } },
} as const satisfies Prisma.work_itemsSelect;

export type ListDailyReportItemsInput = {
  readonly actorId: string;
  readonly projectIds: readonly string[];
  readonly sprintIds?: readonly string[];
  readonly start: Date;
  readonly endExclusive: Date;
};

function normalizedStatusCategory(row: {
  readonly status_category: string;
  readonly state: unknown;
  readonly status: Parameters<typeof resolveWorkItemState>[0]['status'];
  readonly board_column_id: string | null;
  readonly state_workflow_id: string;
}): WorkflowStateCategory {
  if (
    (WORKFLOW_STATE_CATEGORIES as readonly string[]).includes(
      row.status_category
    )
  ) {
    return row.status_category as WorkflowStateCategory;
  }
  return resolveWorkItemState({
    state: row.state,
    status: row.status,
    boardColumnId: row.board_column_id,
    workflowId: row.state_workflow_id,
  }).category;
}

export class ReportsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async listDailyReportItems(
    input: ListDailyReportItemsInput
  ): Promise<DailyReportSourceItem[]> {
    if (input.projectIds.length === 0) {
      return [];
    }

    const rows = await prisma.work_items.findMany({
      where: {
        assignee_id: input.actorId,
        project_id: { in: [...input.projectIds] },
        ...(input.sprintIds ? { sprint_id: { in: [...input.sprintIds] } } : {}),
        record_status: RecordStatus.active,
        OR: [
          { status_category: { not: 'done' } },
          { done_at: { gte: input.start, lt: input.endExclusive } },
        ],
      },
      select: dailyReportWorkItemSelect,
      orderBy: [{ due_date: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      priority: row.priority,
      project: row.project,
      sprint: row.sprint,
      dueDate: row.due_date?.toISOString().slice(0, 10) ?? null,
      storyPoints: row.story_points,
      statusCategory: normalizedStatusCategory(row),
      stateId: row.state_id,
      labels: parseWorkItemLabels(row.labels),
      doneAt: row.done_at?.toISOString() ?? null,
    }));
  }
}
