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

/** Ideal remaining on `dayLabel` (YYYY-MM-DD) for a linear burndown. */
export function computeBurndownIdeal(
  estimatedTotal: number,
  startDate: string,
  endDate: string,
  dayLabel: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const day = new Date(dayLabel);
  const durationDays = (end.getTime() - start.getTime()) / 86_400_000;
  if (durationDays === 0) {
    return 0;
  }
  const elapsed = (day.getTime() - start.getTime()) / 86_400_000;
  const ideal = Math.max(0, estimatedTotal * (1 - elapsed / durationDays));
  return Math.round(ideal * 100) / 100;
}

/**
 * Attach ideal values to rollup remaining rows (ideal is derived, not stored).
 */
export function seriesFromBurndownRollupRows(
  sprint: Pick<BurndownSprintInput, 'start_date' | 'end_date'>,
  rows: readonly {
    readonly bucket_date: string;
    readonly remaining: number | null;
    readonly estimated_total: number;
  }[]
): BurndownSeriesResult {
  if (rows.length === 0) {
    return { estimatedTotal: 0, series: [] };
  }
  const estimatedTotal = rows[0]!.estimated_total;
  const series: BurndownPoint[] = rows.map((row) => ({
    date: row.bucket_date,
    remaining: row.remaining,
    ideal: computeBurndownIdeal(
      estimatedTotal,
      sprint.start_date,
      sprint.end_date,
      row.bucket_date
    ),
  }));
  return { estimatedTotal, series };
}

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

  const series: BurndownPoint[] = [];
  const hasWorkLogs = workLogs.length > 0;

  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dayLabel = cur.toISOString().slice(0, 10);
    const ideal = computeBurndownIdeal(
      estimatedTotal,
      sprint.start_date,
      sprint.end_date,
      dayLabel
    );

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
      ideal,
    });
  }

  return { estimatedTotal, series };
}
