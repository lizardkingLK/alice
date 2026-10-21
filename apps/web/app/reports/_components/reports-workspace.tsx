'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  GenerateReportRequest,
  GenerateReportResponse,
  ReportVerbosity,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  AlertCircle,
  CalendarDays,
  Download,
  FileText,
  LoaderCircle,
} from '@repo/ui/lib/icons';
import { ChatMarkdown } from '@/app/chat/_components/chat-markdown';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  SESSION_EXPIRED_MESSAGE,
  isSessionExpiredError,
} from '@/lib/errors/session-expired';
import { downloadReportMarkdown } from '../_helpers/report-download';
import {
  currentDateInTimezone,
  getBrowserTimezone,
  parseReportUrlState,
  serializeReportUrlState,
  type ReportUrlState,
} from '../_helpers/reports-url-state';
import { generateDailyReport } from '../_services/reports.mutations.client';

export type ReportProjectOption = {
  readonly id: string;
  readonly name: string;
  readonly key: string;
};

export type ReportSprintOption = {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
};

type ReportsWorkspaceProps = {
  readonly projects: readonly ReportProjectOption[];
  readonly sprints: readonly ReportSprintOption[];
};

const TIMEZONE_SUGGESTIONS = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Colombo',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

function displayError(error: unknown): string {
  if (isSessionExpiredError(error)) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return SESSION_EXPIRED_MESSAGE;
    }
    if (error.status === 403) {
      return 'You do not have access to one or more selected projects or sprints.';
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : 'The report could not be generated. Please try again.';
}

function toggleId(
  ids: readonly string[],
  id: string,
  checked: boolean
): string[] {
  if (checked) {
    return ids.includes(id) ? [...ids] : [...ids, id];
  }
  return ids.filter((value) => value !== id);
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
 return (
  <dl className="bg-muted/40 rounded-lg border px-3 py-2.5">
    <dt className="text-muted-foreground text-xs font-medium">
      {label}
    </dt>
    <dd className="mt-1 text-2xl font-semibold tabular-nums">
      {value}
    </dd>
  </dl>
);
}

function FilterList({
  legend,
  allLabel,
  emptyLabel,
  options,
  selectedIds,
  onChange,
}: {
  readonly legend: string;
  readonly allLabel: string;
  readonly emptyLabel: string;
  readonly options: readonly { id: string; label: string }[];
  readonly selectedIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onChange: (_id: string, _checked: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-muted-foreground text-xs">
        {selectedIds.length === 0 ? allLabel : `${selectedIds.length} selected`}
      </p>
      {options.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          {emptyLabel}
        </p>
      ) : (
        <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-3">
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <Checkbox
                id={`${legend}-${option.id}`}
                checked={selectedIds.includes(option.id)}
                onCheckedChange={(checked) =>
                  onChange(option.id, checked === true)
                }
              />
              <Label
                htmlFor={`${legend}-${option.id}`}
                className="min-w-0 cursor-pointer truncate text-sm font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function isEmptyReport(report: GenerateReportResponse): boolean {
  return Object.values(report.snapshot.summary).every((value) => value === 0);
}

function retainSprintsForProjects(
  sprintIds: readonly string[],
  projectIds: readonly string[],
  sprints: readonly ReportSprintOption[]
): string[] {
  if (projectIds.length === 0) {
    return [...sprintIds];
  }
  const visibleProjects = new Set(projectIds);
  const visibleSprintIds = new Set(
    sprints
      .filter((sprint) => visibleProjects.has(sprint.projectId))
      .map((sprint) => sprint.id)
  );
  return sprintIds.filter((sprintId) => visibleSprintIds.has(sprintId));
}

export function ReportsWorkspace({ projects, sprints }: ReportsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<ReportUrlState>(() => {
    const parsed = parseReportUrlState(searchParams, {
      browserTimezone: 'UTC',
      projectIds: projects.map((project) => project.id),
      sprintIds: sprints.map((sprint) => sprint.id),
    });
    return {
      ...parsed,
      sprintIds: retainSprintsForProjects(
        parsed.sprintIds,
        parsed.projectIds,
        sprints
      ),
    };
  });
  const [report, setReport] = useState<GenerateReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSprints = useMemo(() => {
    if (config.projectIds.length === 0) {
      return sprints;
    }
    const selectedProjects = new Set(config.projectIds);
    return sprints.filter((sprint) => selectedProjects.has(sprint.projectId));
  }, [config.projectIds, sprints]);

  function replaceUrl(next: ReportUrlState) {
    const query = serializeReportUrlState(next).toString();
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  function updateConfig(
    // eslint-disable-next-line no-unused-vars -- state updater signature
    update: (_current: ReportUrlState) => ReportUrlState
  ): void {
    const next = update(config);
    setConfig(next);
    replaceUrl(next);
    setError(null);
  }

  useEffect(() => {
    if (searchParams.get('timezone')) {
      return;
    }
    const timezone = getBrowserTimezone();
    const next = {
      ...config,
      timezone,
      reportDate: searchParams.get('date')
        ? config.reportDate
        : currentDateInTimezone(new Date(), timezone),
    };
    setConfig(next);
    replaceUrl(next);
    // Browser defaults are resolved exactly once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const request: GenerateReportRequest = {
        reportType: 'daily',
        reportDate: config.reportDate,
        timezone: config.timezone,
        verbosity: config.verbosity,
        ...(config.projectIds.length > 0
          ? { projectIds: config.projectIds }
          : {}),
        ...(config.sprintIds.length > 0 ? { sprintIds: config.sprintIds } : {}),
      };
      setReport(await generateDailyReport(request));
    } catch (caught) {
      setError(displayError(caught));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="text-primary size-5" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Daily Report
          </h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Build a personal Markdown summary from work assigned to you.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Report configuration</CardTitle>
            <CardDescription>
              Daily Report is the only report type available in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="report-date">Report date</Label>
                <Input
                  id="report-date"
                  type="date"
                  required
                  value={config.reportDate}
                  onChange={(event) =>
                    updateConfig((current) => ({
                      ...current,
                      reportDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-timezone">Timezone</Label>
                <Input
                  id="report-timezone"
                  type="text"
                  list="report-timezones"
                  required
                  value={config.timezone}
                  onChange={(event) =>
                    updateConfig((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                />
                <datalist id="report-timezones">
                  {TIMEZONE_SUGGESTIONS.map((timezone) => (
                    <option key={timezone} value={timezone} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-verbosity">Report Detail</Label>
                <select
                  id="report-verbosity"
                  aria-describedby="report-detail-description"
                  value={config.verbosity}
                  onChange={(event) =>
                    updateConfig((current) => ({
                      ...current,
                      verbosity: event.target.value as ReportVerbosity,
                    }))
                  }
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
                >
                  <option value="concise">Short</option>
                  <option value="standard">Normal</option>
                  <option value="detailed">Detailed</option>
                </select>
                <p
                  id="report-detail-description"
                  className="text-muted-foreground text-xs"
                >
                  Choose how much information to include in your report.
                </p>
              </div>

              <FilterList
                legend="Projects"
                allLabel="All accessible projects"
                emptyLabel="No accessible projects"
                options={projects.map((project) => ({
                  id: project.id,
                  label: `${project.name} (${project.key})`,
                }))}
                selectedIds={config.projectIds}
                onChange={(id, checked) =>
                  updateConfig((current) => {
                    const projectIds = toggleId(
                      current.projectIds,
                      id,
                      checked
                    );
                    return {
                      ...current,
                      projectIds,
                      sprintIds: retainSprintsForProjects(
                        current.sprintIds,
                        projectIds,
                        sprints
                      ),
                    };
                  })
                }
              />

              <FilterList
                legend="Sprints"
                allLabel="All sprints"
                emptyLabel="No sprints available for the selected projects"
                options={visibleSprints.map((sprint) => ({
                  id: sprint.id,
                  label: sprint.name,
                }))}
                selectedIds={config.sprintIds}
                onChange={(id, checked) =>
                  updateConfig((current) => ({
                    ...current,
                    sprintIds: toggleId(current.sprintIds, id, checked),
                  }))
                }
              />

              {error ? (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2 rounded-md border p-3 text-sm"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={isGenerating}
                aria-label={
                  isGenerating ? 'Generating report' : 'Generate report'
                }
              >
                {isGenerating ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <FileText aria-hidden />
                )}
                {isGenerating ? 'Generating…' : 'Generate report'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-96">
          <CardHeader className="border-b">
            <CardTitle>Report preview</CardTitle>
            {report ? (
              <>
                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{report.metadata.reportDate}</span>
                  <span>{report.metadata.timezone}</span>
                  <span>
                    Generated{' '}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(report.metadata.generatedAt))}
                  </span>
                </CardDescription>
                <CardAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadReportMarkdown(
                        report.markdown,
                        report.metadata.reportType,
                        report.metadata.reportDate
                      )
                    }
                  >
                    <Download aria-hidden />
                    Download Markdown
                  </Button>
                </CardAction>
              </>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            {!report ? (
              <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <CalendarDays className="size-9" aria-hidden />
                <div>
                  <p className="text-foreground font-medium">
                    Configure your report
                  </p>
                  <p className="mt-1 text-sm">
                    Choose your filters, then generate a preview. Reports are
                    not generated automatically.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Metric
                    label="Completed"
                    value={report.snapshot.summary.completed}
                  />
                  <Metric
                    label="In progress"
                    value={report.snapshot.summary.inProgress}
                  />
                  <Metric
                    label="Pending"
                    value={report.snapshot.summary.pending}
                  />
                  <Metric
                    label="Blocked"
                    value={report.snapshot.summary.blocked}
                  />
                  <Metric
                    label="Overdue"
                    value={report.snapshot.summary.overdue}
                  />
                </div>

                <div className="bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs">
                  Completed tasks reflect the selected report date. Ongoing,
                  pending, blocked, overdue, and upcoming deadline sections use
                  current work-item state.
                </div>

                {isEmptyReport(report) ? (
                  <div className="rounded-md border border-dashed px-4 py-5 text-center">
                    <p className="font-medium">No matching work items</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      The report is empty for this date and filter selection.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-lg border p-4 sm:p-5">
                  <ChatMarkdown content={report.markdown} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
