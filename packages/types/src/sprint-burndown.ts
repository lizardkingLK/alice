/** One day of a sprint burndown series. */
export type BurndownPoint = {
  date: string;
  remaining: number | null;
  ideal: number;
};

/** Sprint fields required to compute a burndown series. */
export type BurndownSprintInput = {
  start_date: string;
  end_date: string;
  status: string;
};

/** Work-item fields used for estimated total and done_at fallback remaining. */
export type BurndownWorkItemInput = {
  story_points: number | null;
  done_at: string | null;
};

/** Work-log fields used when remaining is driven by logged hours. */
export type BurndownWorkLogInput = {
  logged_at: string;
  logged_hours: number;
};

export type BurndownSeriesResult = {
  estimatedTotal: number;
  series: BurndownPoint[];
};

/** API/RSC response shape for a sprint burndown chart. */
export type SprintBurndownPayload = {
  sprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  estimatedTotal: number;
  series: BurndownPoint[];
};

/**
 * Build ideal + remaining series for a sprint.
 * Shared by Express `GET /api/sprints/:id/burndown` and the web RSC reader.
 *
 * Remaining prefers work logs (1 logged hour ≈ 1 spent point); otherwise
 * falls back to unfinished story points via `done_at`.
 */
export function computeBurndown(
  sprint: BurndownSprintInput,
  items: BurndownWorkItemInput[],
  workLogs: BurndownWorkLogInput[]
): BurndownSeriesResult {
  const start = new Date(sprint.start_date);
  const end = new Date(sprint.end_date);
  const todayStr = new Date().toISOString().slice(0, 10);

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.story_points ?? 0),
    0
  );

  const durationDays = (end.getTime() - start.getTime()) / 86_400_000;
  const series: BurndownPoint[] = [];
  const hasWorkLogs = workLogs.length > 0;

  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dayLabel = cur.toISOString().slice(0, 10);
    const elapsed = (cur.getTime() - start.getTime()) / 86_400_000;
    const ideal =
      durationDays === 0
        ? 0
        : Math.max(0, estimatedTotal * (1 - elapsed / durationDays));

    const isPast = sprint.status === 'closed' ? true : dayLabel <= todayStr;

    let remaining: number | null = null;
    if (isPast) {
      if (hasWorkLogs) {
        const spent = workLogs.reduce((sum, log) => {
          const loggedDay = log.logged_at.slice(0, 10);
          return loggedDay <= dayLabel ? sum + log.logged_hours : sum;
        }, 0);
        remaining = Math.max(0, estimatedTotal - spent);
      } else {
        remaining = items.reduce((sum, item) => {
          const doneBefore =
            item.done_at !== null && item.done_at.slice(0, 10) <= dayLabel;
          return doneBefore ? sum : sum + (item.story_points ?? 0);
        }, 0);
      }
    }

    series.push({
      date: dayLabel,
      remaining,
      ideal: Math.round(ideal * 100) / 100,
    });
  }

  return { estimatedTotal, series };
}
