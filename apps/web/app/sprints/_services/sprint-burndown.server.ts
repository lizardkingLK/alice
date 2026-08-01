import { createClient } from '@/lib/supabase/server';
import { isMissingRelationError, throwIfError } from '@/lib/db/query';
import { 
  computeBurndown,
  type SprintBurndownPayload,
  type Tables,
  type BurndownPoint,
  type SprintBurndownPayload,
} from '@repo/types';

type BurndownWorkItem = {
  id: string;
  story_points: number | null;
  done_at: string | null;
};

type BurndownWorkLog = {
  logged_at: string;
  logged_hours: number;
};

/**
 * RSC burndown reader — Supabase direct, no `web → api` hop.
 * Mirrors `GET /api/sprints/:id/burndown` for dashboard SSR.
 * Series math lives in `@repo/types` (`computeBurndown`) so API and web stay in sync.
 */
export async function getSprintBurndownServer(
  sprintId: string
): Promise<SprintBurndownPayload | null> {
  const supabase = await createClient();

  const { data: sprint, error: sprintError } = await supabase
    .from('sprints')
    .select('id, name, start_date, end_date, status')
    .eq('id', sprintId)
    .maybeSingle();

  throwIfError(
    sprintError,
    'failed to fetch sprint for burndown',
    'Failed to fetch sprint'
  );

  if (!sprint) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('work_items')
    .select('id, story_points, done_at')
    .eq('sprint_id', sprintId);

  throwIfError(
    itemsError,
    'failed to fetch work items for burndown',
    'Failed to fetch work items for burndown'
  );

  const workItems = (items ?? []) as BurndownWorkItem[];
  const workItemIds = workItems.map((item) => item.id);

  let workLogs: BurndownWorkLog[] = [];
  if (workItemIds.length > 0) {
    const { data: logs, error: logsError } = await supabase
      .from('work_item_worklogs' as unknown as never)
      .select('logged_at, logged_hours')
      .in('work_item_id', workItemIds);

    if (logsError) {
      if (isMissingRelationError(logsError)) {
        console.warn(
          'warn. work_item_worklogs is not available yet; burndown falls back to done_at.'
        );
      } else {
        throwIfError(
          logsError,
          'failed to fetch work logs for burndown',
          'Failed to fetch work logs for burndown'
        );
      }
    } else {
      workLogs = (logs ?? []) as unknown as BurndownWorkLog[];
    }
  }

  const sprintRow = sprint as Pick<
    Tables<'sprints'>,
    'id' | 'name' | 'start_date' | 'end_date' | 'status'
  >;
  const { estimatedTotal, series } = computeBurndown(
    sprintRow,
    workItems,
    workLogs
  );

  return {
    sprint: {
      id: sprintRow.id,
      name: sprintRow.name,
      startDate: sprintRow.start_date,
      endDate: sprintRow.end_date,
      status: sprintRow.status,
    },
    estimatedTotal,
    series,
  };
}
