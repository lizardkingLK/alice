'use client';

import { Progress } from '@repo/ui/components/ui/progress';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  sprintContributionLoggedBand,
  sprintContributionPercent,
  type ChartSprintContributionResponse,
  type ChartSprintContributionRowWire,
} from '@repo/types';
import {
  SPRINT_CONTRIBUTION_GROUP_LABELS,
  sprintContributionLoggedIndicatorClass,
} from '@/app/charts/_helpers/charts-sprint-contribution-widget';

const IDEAL_INDICATOR_CLASS = 'bg-cyan-600';

function MetricProgressCell({
  value,
  total,
  indicatorClassName,
}: Readonly<{
  value: number;
  total: number;
  indicatorClassName: string;
}>) {
  const percent = sprintContributionPercent(value, total);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Progress
        value={percent}
        className="h-2"
        indicatorClassName={indicatorClassName}
      />
      <span className="text-muted-foreground text-xs tabular-nums">
        {value.toFixed(1)}
        {total > 0 ? ` / ${total.toFixed(1)}` : ''}
      </span>
    </div>
  );
}

function MemberLabel({
  row,
}: Readonly<{ row: ChartSprintContributionRowWire }>) {
  if (row.group === 'unassigned') {
    return <span className="text-sm font-medium">Unassigned</span>;
  }
  return (
    <TruncatedText className="text-sm font-medium">
      {row.assigneeName ?? 'Unknown member'}
    </TruncatedText>
  );
}

function ContributionRow({
  row,
}: Readonly<{ row: ChartSprintContributionRowWire }>) {
  const loggedBand = sprintContributionLoggedBand(
    row.loggedHours,
    row.estimatedPoints
  );

  return (
    <tr
      className={cn(
        'border-border/60 border-b last:border-b-0',
        row.behind && 'bg-destructive/5 border-l-destructive border-l-2'
      )}
    >
      <td className="px-2 py-2 align-middle">
        <div className="flex min-w-0 flex-col gap-0.5">
          <MemberLabel row={row} />
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
            {row.behind ? ' · Behind pace' : ''}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="flex min-w-0 flex-col gap-1">
          <Progress
            value={row.estimatedPoints > 0 ? 100 : 0}
            className="h-2"
            indicatorClassName="bg-sky-500"
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {row.estimatedPoints.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 align-middle">
        <MetricProgressCell
          value={row.loggedHours}
          total={row.estimatedPoints}
          indicatorClassName={sprintContributionLoggedIndicatorClass(
            loggedBand
          )}
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <MetricProgressCell
          value={row.idealSpent}
          total={row.estimatedPoints}
          indicatorClassName={IDEAL_INDICATOR_CLASS}
        />
      </td>
    </tr>
  );
}

export function ChartsSprintContributionTable({
  payload,
}: Readonly<{
  payload: ChartSprintContributionResponse;
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <p className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
        As of {payload.asOf} · {payload.sprintName}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <thead className="bg-background sticky top-0 z-[1]">
            <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
              <th className="px-2 py-1.5 font-medium">Member</th>
              <th className="px-2 py-1.5 font-medium">Estimate</th>
              <th className="px-2 py-1.5 font-medium">Logged</th>
              <th className="px-2 py-1.5 font-medium">Ideal</th>
            </tr>
          </thead>
          {payload.groups.map((group) => {
            if (group.rows.length === 0) {
              return null;
            }
            return (
              <tbody key={group.id}>
                <tr className="bg-muted/40">
                  <td
                    colSpan={4}
                    className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                  >
                    {SPRINT_CONTRIBUTION_GROUP_LABELS[group.id]}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <ContributionRow
                    key={`${group.id}:${row.assigneeId ?? 'unassigned'}`}
                    row={row}
                  />
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
